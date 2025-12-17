"""
OmniParser wrapper for UI element detection

This module wraps OmniParser (or provides mock implementations)
for detecting UI elements from screenshots.
"""

import io
import logging
import os
from abc import ABC, abstractmethod
from typing import Optional

from PIL import Image

logger = logging.getLogger(__name__)


class BaseParser(ABC):
    """Abstract base class for UI element parsers"""
    
    @abstractmethod
    def parse(self, image: Image.Image) -> list[dict]:
        """
        Parse an image and return detected UI elements.
        
        Args:
            image: PIL Image object
            
        Returns:
            List of detection dicts with keys:
                - bbox: [x1, y1, x2, y2]
                - label: element type
                - confidence: detection confidence
                - text: OCR text (optional)
                - caption: description (optional)
        """
        pass


class MockParser(BaseParser):
    """
    Mock parser for testing without OmniParser.
    Returns simulated detections based on image regions.
    """
    
    def parse(self, image: Image.Image) -> list[dict]:
        """Generate mock detections for testing"""
        width, height = image.size
        
        # Generate some mock elements based on common UI patterns
        detections = [
            # Header area
            {
                "bbox": [20, 20, 200, 60],
                "label": "text",
                "confidence": 0.95,
                "text": "Poker Admin",
                "caption": "header title",
            },
            # Navigation
            {
                "bbox": [20, 80, 180, 120],
                "label": "button",
                "confidence": 0.92,
                "text": "Dashboard",
                "caption": "navigation button",
            },
            {
                "bbox": [20, 130, 180, 170],
                "label": "button",
                "confidence": 0.91,
                "text": "Players",
                "caption": "navigation button",
            },
            {
                "bbox": [20, 180, 180, 220],
                "label": "button",
                "confidence": 0.90,
                "text": "Tournaments",
                "caption": "navigation button",
            },
            # Main content area - search
            {
                "bbox": [220, 100, 500, 140],
                "label": "input",
                "confidence": 0.88,
                "text": "",
                "caption": "search input field",
            },
            {
                "bbox": [510, 100, 590, 140],
                "label": "button",
                "confidence": 0.93,
                "text": "Search",
                "caption": "search button",
            },
            # Table headers
            {
                "bbox": [220, 160, 320, 200],
                "label": "text",
                "confidence": 0.85,
                "text": "Name",
                "caption": "table header",
            },
            {
                "bbox": [330, 160, 430, 200],
                "label": "text",
                "confidence": 0.85,
                "text": "Status",
                "caption": "table header",
            },
            {
                "bbox": [440, 160, 540, 200],
                "label": "text",
                "confidence": 0.85,
                "text": "Balance",
                "caption": "table header",
            },
        ]
        
        # Add more elements if image is large enough
        if height > 400:
            detections.extend([
                # Table rows
                {
                    "bbox": [220, 210, 320, 250],
                    "label": "text",
                    "confidence": 0.87,
                    "text": "John Doe",
                    "caption": "player name",
                },
                {
                    "bbox": [330, 210, 430, 250],
                    "label": "text",
                    "confidence": 0.86,
                    "text": "Active",
                    "caption": "player status",
                },
                {
                    "bbox": [440, 210, 540, 250],
                    "label": "text",
                    "confidence": 0.84,
                    "text": "$1,500",
                    "caption": "player balance",
                },
                {
                    "bbox": [550, 210, 620, 250],
                    "label": "button",
                    "confidence": 0.89,
                    "text": "Edit",
                    "caption": "edit button",
                },
            ])
        
        return detections


class OmniParser(BaseParser):
    """
    OmniParser wrapper for real UI element detection.
    
    Uses YOLO for detection + EasyOCR or LLaVA for text extraction.
    Falls back to MockParser if dependencies are not available.
    """
    
    def __init__(
        self,
        model_path: Optional[str] = None,
        device: str = "auto",
        use_llava: bool = False,
        llava_model: str = "llava",
        ollama_url: str = "http://localhost:11434",
    ):
        """
        Initialize OmniParser.
        
        Args:
            model_path: Path to the OmniParser model weights
            device: 'cuda', 'cpu', or 'auto'
            use_llava: Use LLaVA for OCR instead of EasyOCR
            llava_model: LLaVA model name ('llava' or 'llava-phi3')
            ollama_url: Ollama API URL
        """
        self.model_path = model_path
        self.device = device
        self.use_llava = use_llava
        self.llava_model = llava_model
        self.ollama_url = ollama_url
        self._real_parser = None
        self._fallback = MockParser()
        
        # Try to load the real parser
        self._load_real_parser()
    
    def _load_real_parser(self):
        """Attempt to load the real OmniParser"""
        try:
            from .omniparser_real import create_real_parser, OMNIPARSER_AVAILABLE
            
            if not OMNIPARSER_AVAILABLE:
                logger.info("OmniParser dependencies not installed, using mock parser")
                return
            
            self._real_parser = create_real_parser(
                model_path=self.model_path,
                device=self.device,
                enable_ocr=True,
                enable_captioning=False,  # Disabled by default for speed
                use_llava=self.use_llava,
                llava_model=self.llava_model,
                ollama_url=self.ollama_url,
            )
            
            if self._real_parser:
                ocr_backend = f"LLaVA ({self.llava_model})" if self.use_llava else "EasyOCR"
                logger.info(f"Real OmniParser loaded successfully with {ocr_backend}")
            else:
                logger.info("Failed to load OmniParser, using mock parser")
                
        except ImportError as e:
            logger.info(f"OmniParser module not available: {e}")
        except Exception as e:
            logger.warning(f"Failed to load OmniParser: {e}. Using mock parser.")
    
    def parse(self, image: Image.Image) -> list[dict]:
        """
        Parse an image using OmniParser.
        
        Falls back to mock parser if OmniParser is not loaded.
        """
        if self._real_parser is not None:
            try:
                return self._real_parser.parse(image)
            except Exception as e:
                logger.error(f"OmniParser inference failed: {e}, falling back to mock")
        
        # Fallback to mock parser
        logger.debug("Using mock parser for detection")
        return self._fallback.parse(image)
    
    @property
    def is_real(self) -> bool:
        """Check if real OmniParser is loaded"""
        return self._real_parser is not None


def get_parser(
    use_mock: bool = False,
    model_path: Optional[str] = None,
    device: str = "auto",
    use_llava: bool = False,
    llava_model: str = "llava",
    ollama_url: str = "http://localhost:11434",
) -> BaseParser:
    """
    Get a parser instance.
    
    Args:
        use_mock: Force use of mock parser
        model_path: Path to OmniParser model
        device: Device for inference ('cuda', 'cpu', 'auto')
        use_llava: Use LLaVA for OCR instead of EasyOCR
        llava_model: LLaVA model name ('llava' or 'llava-phi3')
        ollama_url: Ollama API URL
        
    Returns:
        Parser instance
    """
    if use_mock:
        logger.info("Using mock parser (explicitly requested)")
        return MockParser()
    
    # Try to use real OmniParser
    parser = OmniParser(
        model_path=model_path,
        device=device,
        use_llava=use_llava,
        llava_model=llava_model,
        ollama_url=ollama_url,
    )
    
    if parser.is_real:
        ocr_backend = f"LLaVA ({llava_model})" if use_llava else "EasyOCR"
        logger.info(f"Using real OmniParser with {ocr_backend}")
    else:
        logger.info("Using mock parser (OmniParser not available)")
    
    return parser
