"""
LLaVA Vision Integration for improved text extraction and UI understanding.

Uses Ollama's LLaVA model for:
- More accurate text extraction (replaces EasyOCR)
- Better UI element understanding
- Contextual element descriptions
"""

import base64
import logging
import io
from typing import Optional
import httpx
from PIL import Image

logger = logging.getLogger(__name__)

# Check if Ollama is available
LLAVA_AVAILABLE = False
OLLAMA_BASE_URL = "http://localhost:11434"

try:
    import httpx
    LLAVA_AVAILABLE = True
except ImportError:
    logger.warning("httpx not installed, LLaVA integration unavailable")


class LLaVAVision:
    """
    LLaVA Vision integration via Ollama for improved UI understanding.
    """
    
    def __init__(
        self,
        model: str = "llava",
        ollama_url: str = "http://localhost:11434",
        timeout: float = 30.0,
    ):
        """
        Initialize LLaVA Vision.
        
        Args:
            model: Ollama model name ('llava' or 'llava-phi3')
            ollama_url: Ollama API URL
            timeout: Request timeout in seconds
        """
        self.model = model
        self.ollama_url = ollama_url
        self.timeout = timeout
        self.client = httpx.Client(timeout=timeout)
        
        # Verify connection
        self._verify_connection()
    
    def _verify_connection(self) -> bool:
        """Verify Ollama is running and model is available"""
        try:
            response = self.client.get(f"{self.ollama_url}/api/tags")
            if response.status_code == 200:
                models = response.json().get("models", [])
                model_names = [m.get("name", "").split(":")[0] for m in models]
                if self.model.split(":")[0] in model_names:
                    logger.info(f"LLaVA model '{self.model}' is available")
                    return True
                else:
                    logger.warning(f"Model '{self.model}' not found. Available: {model_names}")
                    return False
            return False
        except Exception as e:
            logger.warning(f"Cannot connect to Ollama: {e}")
            return False
    
    def _image_to_base64(self, image: Image.Image) -> str:
        """Convert PIL Image to base64 string"""
        buffer = io.BytesIO()
        image.save(buffer, format="PNG")
        return base64.b64encode(buffer.getvalue()).decode("utf-8")
    
    def extract_text(self, image: Image.Image) -> list[dict]:
        """
        Extract all text from an image using LLaVA.
        
        Args:
            image: PIL Image
            
        Returns:
            List of detected text with approximate positions
        """
        prompt = """You are a UI analyzer. Examine this screenshot and list EVERY visible text element, including:
- Headings and titles
- Button text
- Input field labels (like "Email", "Password", "Username")
- Links and navigation items
- Placeholder text
- Small text and captions

For each text element provide:
- text: exact text content
- position: location (top-left, top-center, top-right, center-left, center, center-right, bottom-left, bottom-center, bottom-right)
- type: element type (heading, button, label, input, link, text)

IMPORTANT: Include ALL text you can see, even small labels near input fields.

Return as JSON array only:
[{"text": "Email Address", "position": "center-left", "type": "label"}, {"text": "Sign In", "position": "center", "type": "button"}]"""

        try:
            response = self.client.post(
                f"{self.ollama_url}/api/generate",
                json={
                    "model": self.model,
                    "prompt": prompt,
                    "images": [self._image_to_base64(image)],
                    "stream": False,
                    "options": {
                        "temperature": 0.1,
                        "num_predict": 1000,
                    }
                }
            )
            
            if response.status_code == 200:
                result = response.json().get("response", "")
                logger.info(f"LLaVA raw response: {result[:500]}...")
                parsed = self._parse_text_response(result)
                logger.info(f"LLaVA parsed {len(parsed)} elements")
                return parsed
            else:
                logger.error(f"LLaVA request failed: {response.status_code}")
                logger.error(f"Response: {response.text[:200]}")
                return []
                
        except Exception as e:
            logger.error(f"LLaVA text extraction failed: {e}")
            return []
    
    def extract_text_from_region(
        self,
        image: Image.Image,
        bbox: tuple[int, int, int, int]
    ) -> str:
        """
        Extract text from a specific region of the image.
        
        Args:
            image: Full PIL Image
            bbox: (x1, y1, x2, y2) bounding box
            
        Returns:
            Extracted text string
        """
        x1, y1, x2, y2 = bbox
        
        # Add padding
        pad = 5
        x1 = max(0, x1 - pad)
        y1 = max(0, y1 - pad)
        x2 = min(image.width, x2 + pad)
        y2 = min(image.height, y2 + pad)
        
        # Crop region
        region = image.crop((x1, y1, x2, y2))
        
        prompt = "What text is shown in this image? Return only the exact text, nothing else."
        
        try:
            response = self.client.post(
                f"{self.ollama_url}/api/generate",
                json={
                    "model": self.model,
                    "prompt": prompt,
                    "images": [self._image_to_base64(region)],
                    "stream": False,
                    "options": {
                        "temperature": 0.1,
                        "num_predict": 100,
                    }
                }
            )
            
            if response.status_code == 200:
                text = response.json().get("response", "").strip()
                # Clean up common LLaVA responses
                if text.lower().startswith("the text"):
                    text = text.split('"')[-2] if '"' in text else text.split(":")[-1].strip()
                return text
            return ""
                
        except Exception as e:
            logger.debug(f"LLaVA region OCR failed: {e}")
            return ""
    
    def describe_element(
        self,
        image: Image.Image,
        bbox: tuple[int, int, int, int]
    ) -> str:
        """
        Generate a description for a UI element.
        
        Args:
            image: Full PIL Image
            bbox: (x1, y1, x2, y2) bounding box
            
        Returns:
            Element description
        """
        x1, y1, x2, y2 = bbox
        region = image.crop((x1, y1, x2, y2))
        
        prompt = """Describe this UI element in 10 words or less. 
Include: element type (button, input, text, icon, etc.) and its purpose.
Example: "Blue login button" or "Email input field" or "Search icon"
Return only the description."""
        
        try:
            response = self.client.post(
                f"{self.ollama_url}/api/generate",
                json={
                    "model": self.model,
                    "prompt": prompt,
                    "images": [self._image_to_base64(region)],
                    "stream": False,
                    "options": {
                        "temperature": 0.2,
                        "num_predict": 50,
                    }
                }
            )
            
            if response.status_code == 200:
                return response.json().get("response", "").strip()
            return ""
                
        except Exception as e:
            logger.debug(f"LLaVA element description failed: {e}")
            return ""
    
    def analyze_screen(self, image: Image.Image) -> dict:
        """
        Analyze entire screen to understand UI context.
        
        Args:
            image: PIL Image
            
        Returns:
            Screen analysis dict
        """
        prompt = """Analyze this UI screenshot and provide:
1. What type of page/screen is this? (login, dashboard, settings, form, etc.)
2. What is the main action a user can take?
3. List the main interactive elements (buttons, inputs, links)

Format as JSON:
{
    "screen_type": "login",
    "main_action": "Sign in to account",
    "elements": ["email input", "password input", "sign in button", "forgot password link"]
}

Return only JSON."""
        
        try:
            response = self.client.post(
                f"{self.ollama_url}/api/generate",
                json={
                    "model": self.model,
                    "prompt": prompt,
                    "images": [self._image_to_base64(image)],
                    "stream": False,
                    "options": {
                        "temperature": 0.1,
                        "num_predict": 500,
                    }
                }
            )
            
            if response.status_code == 200:
                result = response.json().get("response", "")
                return self._parse_json_response(result)
            return {}
                
        except Exception as e:
            logger.error(f"LLaVA screen analysis failed: {e}")
            return {}
    
    def _parse_text_response(self, response: str) -> list[dict]:
        """Parse LLaVA text extraction response"""
        import json
        try:
            # Try to find JSON array in response
            start = response.find("[")
            end = response.rfind("]") + 1
            if start >= 0 and end > start:
                json_str = response[start:end]
                return json.loads(json_str)
        except json.JSONDecodeError:
            pass
        
        # Fallback: parse as plain text
        texts = []
        for line in response.split("\n"):
            line = line.strip()
            if line and not line.startswith(("{", "[", "}")):
                texts.append({"text": line, "position": "unknown", "type": "text"})
        return texts
    
    def _parse_json_response(self, response: str) -> dict:
        """Parse JSON response from LLaVA"""
        import json
        try:
            start = response.find("{")
            end = response.rfind("}") + 1
            if start >= 0 and end > start:
                json_str = response[start:end]
                return json.loads(json_str)
        except json.JSONDecodeError:
            pass
        return {}
    
    def close(self):
        """Close the HTTP client"""
        self.client.close()


def create_llava_vision(
    model: str = "llava",
    ollama_url: str = "http://localhost:11434",
) -> Optional[LLaVAVision]:
    """
    Factory function to create LLaVA Vision instance.
    
    Returns None if not available.
    """
    if not LLAVA_AVAILABLE:
        logger.warning("LLaVA dependencies not available")
        return None
    
    try:
        return LLaVAVision(model=model, ollama_url=ollama_url)
    except Exception as e:
        logger.error(f"Failed to create LLaVA Vision: {e}")
        return None


