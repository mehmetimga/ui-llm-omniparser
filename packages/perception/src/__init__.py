"""
Perception Service - OmniParser wrapper for UI element detection

Supports:
- YOLO for UI element detection
- EasyOCR for text extraction
- LLaVA (via Ollama) for improved text extraction
"""

__version__ = "0.1.0"

from .parser import get_parser, BaseParser, OmniParser, MockParser
from .llava_vision import LLaVAVision, create_llava_vision

__all__ = [
    "get_parser",
    "BaseParser",
    "OmniParser",
    "MockParser",
    "LLaVAVision",
    "create_llava_vision",
]

