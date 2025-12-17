"""
Real OmniParser Integration

This module provides actual OmniParser integration for UI element detection.
Requires: torch, torchvision, ultralytics, easyocr, transformers
"""

import logging
import os
from pathlib import Path
from typing import Optional

import numpy as np
from PIL import Image

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
    - EasyOCR for text extraction
    - Florence-2 for captioning (optional)
    """
    
    def __init__(
        self,
        model_path: Optional[str] = None,
        device: str = "auto",
        confidence_threshold: float = 0.5,
        enable_ocr: bool = True,
        enable_captioning: bool = False,  # Disabled by default (slower)
    ):
        """
        Initialize OmniParser.
        
        Args:
            model_path: Path to models directory
            device: 'cuda', 'cpu', or 'auto'
            confidence_threshold: Minimum detection confidence
            enable_ocr: Enable text extraction
            enable_captioning: Enable element captioning (slower)
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
        
        # Load OCR
        if self.enable_ocr:
            logger.info("Loading EasyOCR...")
            self.ocr_reader = easyocr.Reader(
                ['en'],
                gpu=self.device == "cuda",
                verbose=False
            )
        
        # Load captioner (optional - requires more VRAM)
        if self.enable_captioning:
            self._load_captioner()
    
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
        """Extract text from a region using OCR"""
        try:
            x1, y1, x2, y2 = [int(v) for v in bbox]
            
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
        if not self.captioner:
            return ""
        
        try:
            x1, y1, x2, y2 = [int(v) for v in bbox]
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
    **kwargs
) -> Optional[RealOmniParser]:
    """
    Factory function to create a RealOmniParser.
    
    Returns None if dependencies are not available.
    """
    if not OMNIPARSER_AVAILABLE:
        logger.warning("OmniParser dependencies not available")
        return None
    
    try:
        return RealOmniParser(
            model_path=model_path,
            device=device,
            **kwargs
        )
    except Exception as e:
        logger.error(f"Failed to create OmniParser: {e}")
        return None

