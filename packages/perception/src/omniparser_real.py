"""
Real OmniParser Integration

This module provides actual OmniParser integration for UI element detection.
Requires: torch, torchvision, ultralytics, easyocr, transformers

Optionally uses LLaVA (via Ollama) for improved text extraction.
"""

import logging
import os
from pathlib import Path
from typing import Optional

import numpy as np
from PIL import Image

from .llava_vision import create_llava_vision, LLaVAVision

logger = logging.getLogger(__name__)

# Check if OmniParser dependencies are available
OMNIPARSER_AVAILABLE = False
try:
    import torch
    import easyocr
    from ultralytics import YOLO
    OMNIPARSER_AVAILABLE = True
    logger.info("OmniParser dependencies loaded successfully")
except ImportError as e:
    logger.warning(f"OmniParser dependencies not available: {e}")


class RealOmniParser:
    """
    Real OmniParser implementation using:
    - YOLO for UI element detection
    - EasyOCR or LLaVA for text extraction
    - Florence-2 for captioning (optional)
    """
    
    def __init__(
        self,
        model_path: Optional[str] = None,
        device: str = "auto",
        confidence_threshold: float = 0.5,
        enable_ocr: bool = True,
        enable_captioning: bool = False,  # Disabled by default (slower)
        use_llava: bool = False,  # Use LLaVA for OCR instead of EasyOCR
        llava_model: str = "llava",  # LLaVA model name
        ollama_url: str = "http://localhost:11434",
    ):
        """
        Initialize OmniParser.
        
        Args:
            model_path: Path to models directory
            device: 'cuda', 'cpu', or 'auto'
            confidence_threshold: Minimum detection confidence
            enable_ocr: Enable text extraction
            enable_captioning: Enable element captioning (slower)
            use_llava: Use LLaVA (via Ollama) for OCR instead of EasyOCR
            llava_model: LLaVA model name ('llava' or 'llava-phi3')
            ollama_url: Ollama API URL
        """
        if not OMNIPARSER_AVAILABLE:
            raise RuntimeError(
                "OmniParser dependencies not installed. "
                "Run: pip install torch torchvision ultralytics easyocr"
            )
        
        self.model_path = Path(model_path) if model_path else Path("models")
        self.confidence_threshold = confidence_threshold
        self.enable_ocr = enable_ocr
        self.enable_captioning = enable_captioning
        self.use_llava = use_llava
        self.llava_model = llava_model
        self.ollama_url = ollama_url
        
        # Determine device
        if device == "auto":
            self.device = "cuda" if torch.cuda.is_available() else "cpu"
        else:
            self.device = device
        
        logger.info(f"Using device: {self.device}")
        
        # Load models
        self.detector = None
        self.ocr_reader = None
        self.captioner = None
        self.llava_vision: Optional[LLaVAVision] = None
        
        self._load_models()
    
    def _load_models(self):
        """Load all required models"""
        # Load YOLO detector
        detector_path = self.model_path / "icon_detect" / "model.pt"
        if detector_path.exists():
            logger.info(f"Loading YOLO detector from {detector_path}")
            self.detector = YOLO(str(detector_path))
            self.detector.to(self.device)
        else:
            # Use pretrained YOLOv8 as fallback
            logger.warning("Custom detector not found, using pretrained YOLOv8")
            self.detector = YOLO("yolov8n.pt")
            self.detector.to(self.device)
        
        # Load OCR - prefer LLaVA if enabled
        if self.enable_ocr:
            if self.use_llava:
                logger.info(f"Loading LLaVA Vision ({self.llava_model})...")
                self.llava_vision = create_llava_vision(
                    model=self.llava_model,
                    ollama_url=self.ollama_url
                )
                if self.llava_vision:
                    logger.info("LLaVA Vision loaded successfully")
                else:
                    logger.warning("LLaVA not available, falling back to EasyOCR")
                    self._load_easyocr()
            else:
                self._load_easyocr()
        
        # Load captioner (optional - requires more VRAM)
        if self.enable_captioning:
            self._load_captioner()
    
    def _load_easyocr(self):
        """Load EasyOCR reader"""
        logger.info("Loading EasyOCR...")
        self.ocr_reader = easyocr.Reader(
            ['en'],
            gpu=self.device == "cuda",
            verbose=False
        )
    
    def _load_captioner(self):
        """Load Florence-2 or BLIP-2 for captioning"""
        try:
            from transformers import AutoProcessor, AutoModelForCausalLM
            
            captioner_path = self.model_path / "icon_caption_florence"
            if captioner_path.exists():
                logger.info(f"Loading captioner from {captioner_path}")
                self.captioner_processor = AutoProcessor.from_pretrained(str(captioner_path))
                self.captioner = AutoModelForCausalLM.from_pretrained(
                    str(captioner_path),
                    torch_dtype=torch.float16 if self.device == "cuda" else torch.float32
                ).to(self.device)
            else:
                logger.warning("Captioner model not found, captions will be empty")
        except Exception as e:
            logger.warning(f"Failed to load captioner: {e}")
    
    def parse(self, image: Image.Image) -> list[dict]:
        """
        Parse an image and detect UI elements.
        
        Args:
            image: PIL Image
            
        Returns:
            List of detection dicts
        """
        width, height = image.size
        detections = []
        
        # Convert PIL to numpy for YOLO
        img_array = np.array(image)
        
        # Run YOLO detection
        results = self.detector(
            img_array,
            conf=self.confidence_threshold,
            verbose=False
        )
        
        # Process detections
        for result in results:
            boxes = result.boxes
            if boxes is None:
                continue
            
            for i, box in enumerate(boxes):
                # Get bounding box
                x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
                confidence = float(box.conf[0].cpu().numpy())
                class_id = int(box.cls[0].cpu().numpy())
                
                # Get class name (if available)
                label = result.names.get(class_id, "unknown") if hasattr(result, 'names') else "unknown"
                
                # Extract text via OCR
                text = ""
                if self.enable_ocr and self.ocr_reader:
                    text = self._extract_text(image, (x1, y1, x2, y2))
                
                # Generate caption
                caption = label
                if self.enable_captioning and self.captioner:
                    caption = self._generate_caption(image, (x1, y1, x2, y2))
                
                detection = {
                    "bbox": [int(x1), int(y1), int(x2), int(y2)],
                    "label": self._map_label(label),
                    "confidence": confidence,
                    "text": text,
                    "caption": caption,
                }
                detections.append(detection)
        
        # If no detections from YOLO, try OCR-based detection
        if not detections and self.enable_ocr:
            detections = self._ocr_based_detection(image)
        
        return detections
    
    def _extract_text(
        self,
        image: Image.Image,
        bbox: tuple[float, float, float, float]
    ) -> str:
        """Extract text from a region using OCR (LLaVA or EasyOCR)"""
        try:
            x1, y1, x2, y2 = [int(v) for v in bbox]
            
            # Use LLaVA if available
            if self.llava_vision:
                return self.llava_vision.extract_text_from_region(image, (x1, y1, x2, y2))
            
            # Fallback to EasyOCR
            if not self.ocr_reader:
                return ""
            
            # Add padding
            pad = 5
            x1 = max(0, x1 - pad)
            y1 = max(0, y1 - pad)
            x2 = min(image.width, x2 + pad)
            y2 = min(image.height, y2 + pad)
            
            # Crop region
            region = image.crop((x1, y1, x2, y2))
            region_array = np.array(region)
            
            # Run OCR
            results = self.ocr_reader.readtext(region_array)
            
            # Combine text
            texts = [r[1] for r in results if r[2] > 0.5]
            return " ".join(texts).strip()
        except Exception as e:
            logger.debug(f"OCR failed for region: {e}")
            return ""
    
    def _generate_caption(
        self,
        image: Image.Image,
        bbox: tuple[float, float, float, float]
    ) -> str:
        """Generate caption for a UI element"""
        x1, y1, x2, y2 = [int(v) for v in bbox]
        
        # Use LLaVA for captioning if available
        if self.llava_vision:
            return self.llava_vision.describe_element(image, (x1, y1, x2, y2))
        
        if not self.captioner:
            return ""
        
        try:
            region = image.crop((x1, y1, x2, y2))
            
            # Prepare input
            inputs = self.captioner_processor(
                images=region,
                return_tensors="pt"
            ).to(self.device)
            
            # Generate caption
            with torch.no_grad():
                outputs = self.captioner.generate(
                    **inputs,
                    max_new_tokens=50,
                    do_sample=False
                )
            
            caption = self.captioner_processor.decode(
                outputs[0],
                skip_special_tokens=True
            )
            return caption.strip()
        except Exception as e:
            logger.debug(f"Captioning failed: {e}")
            return ""
    
    def _ocr_based_detection(self, image: Image.Image) -> list[dict]:
        """
        Fallback: detect elements based on OCR results.
        Useful when YOLO doesn't detect UI elements.
        """
        detections = []
        
        # Use LLaVA for full-screen text extraction
        if self.llava_vision:
            return self._llava_based_detection(image)
        
        if not self.ocr_reader:
            return detections
        
        try:
            img_array = np.array(image)
            results = self.ocr_reader.readtext(img_array)
            
            for bbox, text, conf in results:
                if conf < 0.5:
                    continue
                
                # bbox is [[x1,y1], [x2,y1], [x2,y2], [x1,y2]]
                x_coords = [p[0] for p in bbox]
                y_coords = [p[1] for p in bbox]
                x1, x2 = min(x_coords), max(x_coords)
                y1, y2 = min(y_coords), max(y_coords)
                
                # Guess element type based on text and position
                label = self._guess_element_type(text, (x1, y1, x2, y2), image.size)
                
                detection = {
                    "bbox": [int(x1), int(y1), int(x2), int(y2)],
                    "label": label,
                    "confidence": float(conf),
                    "text": text,
                    "caption": f"text element: {text}",
                }
                detections.append(detection)
        except Exception as e:
            logger.error(f"OCR-based detection failed: {e}")
        
        return detections
    
    def _llava_based_detection(self, image: Image.Image) -> list[dict]:
        """
        Use LLaVA for UI element detection.
        More accurate than EasyOCR for text extraction.
        """
        detections = []
        width, height = image.size
        
        if not self.llava_vision:
            return detections
        
        try:
            # Get all text elements from LLaVA
            text_elements = self.llava_vision.extract_text(image)
            logger.info(f"LLaVA detected {len(text_elements)} text elements")
            for elem in text_elements:
                logger.info(f"  -> '{elem.get('text', '')}' ({elem.get('type', 'unknown')}) at {elem.get('position', 'unknown')}")
            
            # Convert position names to approximate coordinates
            position_map = {
                "top-left": (width * 0.15, height * 0.15),
                "top-center": (width * 0.5, height * 0.15),
                "top-right": (width * 0.85, height * 0.15),
                "center-left": (width * 0.15, height * 0.5),
                "center": (width * 0.5, height * 0.5),
                "center-right": (width * 0.85, height * 0.5),
                "bottom-left": (width * 0.15, height * 0.85),
                "bottom-center": (width * 0.5, height * 0.85),
                "bottom-right": (width * 0.85, height * 0.85),
            }
            
            for i, elem in enumerate(text_elements):
                text = elem.get("text", "")
                position = elem.get("position", "center").lower()
                elem_type = elem.get("type", "text").lower()
                
                if not text:
                    continue
                
                # Get approximate center position
                center_x, center_y = position_map.get(position, (width * 0.5, height * 0.5))
                
                # Estimate bounding box size based on text length
                text_width = min(len(text) * 12, width * 0.3)  # ~12px per char
                text_height = 30  # Approximate line height
                
                x1 = max(0, int(center_x - text_width / 2))
                y1 = max(0, int(center_y - text_height / 2))
                x2 = min(width, int(center_x + text_width / 2))
                y2 = min(height, int(center_y + text_height / 2))
                
                # Map element type
                label = elem_type if elem_type in ["button", "input", "link", "heading", "label", "menu item"] else "text"
                
                detection = {
                    "bbox": [x1, y1, x2, y2],
                    "label": label,
                    "confidence": 0.85,  # LLaVA doesn't provide confidence
                    "text": text,
                    "caption": f"{elem_type}: {text}",
                }
                detections.append(detection)
                
        except Exception as e:
            logger.error(f"LLaVA-based detection failed: {e}")
        
        return detections
    
    def _guess_element_type(
        self,
        text: str,
        bbox: tuple[float, float, float, float],
        image_size: tuple[int, int]
    ) -> str:
        """Guess element type based on text content and position"""
        text_lower = text.lower().strip()
        x1, y1, x2, y2 = bbox
        width = x2 - x1
        height = y2 - y1
        
        # Button-like text
        button_keywords = [
            'submit', 'login', 'sign in', 'sign up', 'register',
            'cancel', 'ok', 'save', 'delete', 'edit', 'add',
            'search', 'send', 'next', 'back', 'continue'
        ]
        if any(kw in text_lower for kw in button_keywords):
            return "button"
        
        # Link-like text
        if text_lower.startswith('http') or '@' in text_lower:
            return "link"
        
        # Short text in constrained box might be button
        if len(text) < 20 and width < 200 and height < 60:
            return "button"
        
        return "text"
    
    def _map_label(self, label: str) -> str:
        """Map YOLO class names to our element types"""
        label_lower = label.lower()
        
        mapping = {
            # Common YOLO classes that might appear
            'button': 'button',
            'text': 'text',
            'input': 'input',
            'checkbox': 'checkbox',
            'radio': 'radio',
            'dropdown': 'select',
            'menu': 'menu',
            'icon': 'icon',
            'image': 'image',
            'link': 'link',
            # COCO classes (if using pretrained)
            'person': 'image',
            'car': 'image',
            'dog': 'image',
        }
        
        return mapping.get(label_lower, "unknown")


def create_real_parser(
    model_path: Optional[str] = None,
    device: str = "auto",
    use_llava: bool = False,
    llava_model: str = "llava",
    ollama_url: str = "http://localhost:11434",
    **kwargs
) -> Optional[RealOmniParser]:
    """
    Factory function to create a RealOmniParser.
    
    Args:
        model_path: Path to models directory
        device: 'cuda', 'cpu', or 'auto'
        use_llava: Use LLaVA for OCR instead of EasyOCR
        llava_model: LLaVA model name ('llava' or 'llava-phi3')
        ollama_url: Ollama API URL
        
    Returns None if dependencies are not available.
    """
    if not OMNIPARSER_AVAILABLE:
        logger.warning("OmniParser dependencies not available")
        return None
    
    try:
        return RealOmniParser(
            model_path=model_path,
            device=device,
            use_llava=use_llava,
            llava_model=llava_model,
            ollama_url=ollama_url,
            **kwargs
        )
    except Exception as e:
        logger.error(f"Failed to create OmniParser: {e}")
        return None

