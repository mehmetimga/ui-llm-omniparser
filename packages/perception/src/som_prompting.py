"""
Set-of-Mark (SoM) Visual Prompting

Adds numbered visual markers to screenshots for more accurate LLM element identification.
Based on Microsoft's OmniParser v2 approach.
"""

import logging
from typing import Optional
from PIL import Image, ImageDraw, ImageFont
import io
import base64

logger = logging.getLogger(__name__)

# Color palette for markers (high contrast)
MARKER_COLORS = [
    (255, 0, 0),      # Red
    (0, 255, 0),      # Green
    (0, 0, 255),      # Blue
    (255, 255, 0),    # Yellow
    (255, 0, 255),    # Magenta
    (0, 255, 255),    # Cyan
    (255, 128, 0),    # Orange
    (128, 0, 255),    # Purple
    (0, 255, 128),    # Spring Green
    (255, 0, 128),    # Rose
]


class SoMPrompting:
    """
    Set-of-Mark visual prompting for better LLM element identification.
    
    Adds numbered markers to detected UI elements so LLM can refer to them by number.
    """
    
    def __init__(
        self,
        marker_size: int = 24,
        font_size: int = 16,
        show_bbox: bool = True,
        bbox_thickness: int = 2,
    ):
        """
        Initialize SoM prompting.
        
        Args:
            marker_size: Size of the numbered circle markers
            font_size: Font size for marker numbers
            show_bbox: Whether to draw bounding boxes
            bbox_thickness: Thickness of bounding box lines
        """
        self.marker_size = marker_size
        self.font_size = font_size
        self.show_bbox = show_bbox
        self.bbox_thickness = bbox_thickness
        self._font = None
    
    def _get_font(self) -> ImageFont.FreeTypeFont:
        """Get or create font for markers"""
        if self._font is None:
            try:
                # Try to load a system font
                self._font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", self.font_size)
            except Exception:
                try:
                    self._font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", self.font_size)
                except Exception:
                    # Fallback to default font
                    self._font = ImageFont.load_default()
        return self._font
    
    def add_markers(
        self,
        image: Image.Image,
        detections: list[dict],
    ) -> tuple[Image.Image, list[dict]]:
        """
        Add numbered markers to detected elements.
        
        Args:
            image: PIL Image
            detections: List of detection dicts with 'bbox' key
            
        Returns:
            Tuple of (marked image, updated detections with marker numbers)
        """
        # Create a copy to draw on
        marked_image = image.copy()
        draw = ImageDraw.Draw(marked_image)
        font = self._get_font()
        
        updated_detections = []
        
        for i, det in enumerate(detections):
            marker_num = i + 1
            bbox = det.get("bbox", [0, 0, 0, 0])
            x1, y1, x2, y2 = bbox
            
            # Get color for this marker
            color = MARKER_COLORS[i % len(MARKER_COLORS)]
            
            # Draw bounding box
            if self.show_bbox:
                draw.rectangle(
                    [x1, y1, x2, y2],
                    outline=color,
                    width=self.bbox_thickness
                )
            
            # Draw marker circle at top-left of bbox
            marker_x = x1 - self.marker_size // 2
            marker_y = y1 - self.marker_size // 2
            
            # Ensure marker is within image bounds
            marker_x = max(0, min(marker_x, image.width - self.marker_size))
            marker_y = max(0, min(marker_y, image.height - self.marker_size))
            
            # Draw filled circle
            draw.ellipse(
                [marker_x, marker_y, marker_x + self.marker_size, marker_y + self.marker_size],
                fill=color,
                outline=(255, 255, 255),
                width=2
            )
            
            # Draw number
            text = str(marker_num)
            text_bbox = font.getbbox(text)
            text_width = text_bbox[2] - text_bbox[0]
            text_height = text_bbox[3] - text_bbox[1]
            text_x = marker_x + (self.marker_size - text_width) // 2
            text_y = marker_y + (self.marker_size - text_height) // 2 - 2
            
            draw.text(
                (text_x, text_y),
                text,
                fill=(255, 255, 255),
                font=font
            )
            
            # Update detection with marker number
            updated_det = {
                **det,
                "marker_num": marker_num,
                "marker_color": color,
            }
            updated_detections.append(updated_det)
        
        return marked_image, updated_detections
    
    def create_som_prompt(
        self,
        detections: list[dict],
        task: str = "identify",
    ) -> str:
        """
        Create a prompt for LLM that references the numbered markers.
        
        Args:
            detections: List of detections with marker numbers
            task: What to ask the LLM ('identify', 'click', 'describe')
            
        Returns:
            Formatted prompt string
        """
        if task == "identify":
            prompt = """This UI screenshot has numbered markers (circles with numbers) on interactive elements.

For each numbered marker, describe:
1. The element type (button, input, link, etc.)
2. The text or label on/near the element
3. The likely purpose of the element

Return as JSON:
[{"marker": 1, "type": "button", "text": "Sign In", "purpose": "Submit login form"}]

Only return the JSON array."""

        elif task == "click":
            prompt = """This UI screenshot has numbered markers on interactive elements.

Which marker number should be clicked to accomplish the goal?

Return only the marker number and brief reason:
{"marker": 3, "reason": "This is the Sign In button"}"""

        elif task == "describe":
            prompt = """This UI screenshot has numbered markers on interactive elements.

Describe what you see on the screen:
- Overall page type (login, dashboard, form, etc.)
- Main elements and their marker numbers
- Current state (empty form, filled data, error messages)

Be concise."""

        else:
            prompt = f"Analyze this UI screenshot with numbered markers. {task}"
        
        return prompt
    
    def image_to_base64(self, image: Image.Image) -> str:
        """Convert PIL Image to base64 string"""
        buffer = io.BytesIO()
        image.save(buffer, format="PNG")
        return base64.b64encode(buffer.getvalue()).decode("utf-8")


def create_som_prompting(**kwargs) -> SoMPrompting:
    """Factory function to create SoM prompting instance"""
    return SoMPrompting(**kwargs)

