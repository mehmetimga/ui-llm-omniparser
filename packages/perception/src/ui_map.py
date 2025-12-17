"""
UIMap generation from OmniParser detections
"""

import hashlib
from datetime import datetime
from typing import Any, Optional
from pydantic import BaseModel


class Neighbors(BaseModel):
    """Neighboring elements by direction"""
    left: list[str] = []
    right: list[str] = []
    above: list[str] = []
    below: list[str] = []


class UIElement(BaseModel):
    """A single UI element detected in a screenshot"""
    id: str
    bbox: tuple[int, int, int, int]  # x, y, width, height
    role: str
    text: str = ""
    caption: str = ""
    confidence: float
    interactable: bool
    neighbors: Neighbors = Neighbors()
    attributes: Optional[dict[str, Any]] = None


class ScreenMetadata(BaseModel):
    """Screen metadata"""
    width: int
    height: int
    timestamp: str
    hash: str
    url: Optional[str] = None
    title: Optional[str] = None


class UIMap(BaseModel):
    """Complete UIMap representing a parsed screenshot"""
    screen: ScreenMetadata
    elements: list[UIElement]
    parserVersion: str = "omniparser-v1"
    metadata: Optional[dict[str, Any]] = None


def compute_screen_hash(image_bytes: bytes) -> str:
    """Compute SHA256 hash of screenshot"""
    return hashlib.sha256(image_bytes).hexdigest()


def role_from_label(label: str) -> tuple[str, bool]:
    """
    Map OmniParser label to UIElement role and interactability
    
    Returns:
        (role, interactable)
    """
    label_lower = label.lower()
    
    # Button-like elements
    if any(kw in label_lower for kw in ["button", "btn", "submit", "cancel", "ok", "close"]):
        return "button", True
    
    # Input elements
    if any(kw in label_lower for kw in ["input", "textbox", "text field", "search", "password"]):
        return "input", True
    
    # Links
    if any(kw in label_lower for kw in ["link", "href", "anchor"]):
        return "link", True
    
    # Checkbox/Radio
    if "checkbox" in label_lower:
        return "checkbox", True
    if "radio" in label_lower:
        return "radio", True
    
    # Select/Dropdown
    if any(kw in label_lower for kw in ["select", "dropdown", "combo"]):
        return "select", True
    
    # Menu
    if any(kw in label_lower for kw in ["menu", "nav"]):
        return "menu", True
    
    # Icons
    if "icon" in label_lower:
        return "icon", True
    
    # Tab
    if "tab" in label_lower:
        return "tab", True
    
    # Modal/Dialog
    if any(kw in label_lower for kw in ["modal", "dialog", "popup"]):
        return "modal", False
    
    # Table
    if "table" in label_lower:
        return "table", False
    
    # Card
    if "card" in label_lower:
        return "card", False
    
    # Image
    if any(kw in label_lower for kw in ["image", "img", "picture", "photo"]):
        return "image", False
    
    # Text (default for text-like elements)
    if any(kw in label_lower for kw in ["text", "label", "heading", "title", "paragraph"]):
        return "text", False
    
    # Unknown
    return "unknown", False


def compute_neighbors(elements: list[UIElement], threshold: int = 100) -> None:
    """
    Compute neighbor relationships between elements.
    Modifies elements in-place.
    
    Args:
        elements: List of UIElements
        threshold: Maximum distance to consider as neighbor
    """
    for i, el in enumerate(elements):
        el_x, el_y, el_w, el_h = el.bbox
        el_center_x = el_x + el_w / 2
        el_center_y = el_y + el_h / 2
        
        for j, other in enumerate(elements):
            if i == j:
                continue
            
            other_x, other_y, other_w, other_h = other.bbox
            other_center_x = other_x + other_w / 2
            other_center_y = other_y + other_h / 2
            
            # Calculate distances
            dx = other_center_x - el_center_x
            dy = other_center_y - el_center_y
            
            # Skip if too far
            if abs(dx) > threshold and abs(dy) > threshold:
                continue
            
            # Determine relationship based on relative position
            if abs(dx) > abs(dy):
                # Horizontal relationship
                if dx < 0 and abs(dx) <= threshold:
                    el.neighbors.left.append(other.id)
                elif dx > 0 and abs(dx) <= threshold:
                    el.neighbors.right.append(other.id)
            else:
                # Vertical relationship
                if dy < 0 and abs(dy) <= threshold:
                    el.neighbors.above.append(other.id)
                elif dy > 0 and abs(dy) <= threshold:
                    el.neighbors.below.append(other.id)


def create_ui_map(
    detections: list[dict],
    image_width: int,
    image_height: int,
    image_bytes: bytes,
    url: Optional[str] = None,
    title: Optional[str] = None,
) -> UIMap:
    """
    Create a UIMap from OmniParser detections.
    
    Args:
        detections: List of detection dicts from OmniParser
            Each dict should have: bbox (x1,y1,x2,y2), label, confidence, text (optional)
        image_width: Width of the image
        image_height: Height of the image
        image_bytes: Raw image bytes for hash computation
        url: Optional URL if web page
        title: Optional page title
    
    Returns:
        UIMap object
    """
    elements: list[UIElement] = []
    
    for idx, det in enumerate(detections):
        # Parse bbox - convert from (x1, y1, x2, y2) to (x, y, w, h)
        bbox = det.get("bbox", [0, 0, 0, 0])
        if len(bbox) == 4:
            x1, y1, x2, y2 = bbox
            x, y, w, h = x1, y1, x2 - x1, y2 - y1
        else:
            x, y, w, h = 0, 0, 0, 0
        
        # Get label and map to role
        label = det.get("label", "unknown")
        role, interactable = role_from_label(label)
        
        # Get text and confidence
        text = det.get("text", "")
        confidence = det.get("confidence", 0.0)
        caption = det.get("caption", label)
        
        element = UIElement(
            id=f"E{idx:03d}",
            bbox=(int(x), int(y), int(w), int(h)),
            role=role,
            text=str(text),
            caption=str(caption),
            confidence=float(confidence),
            interactable=interactable,
        )
        elements.append(element)
    
    # Compute neighbor relationships
    compute_neighbors(elements)
    
    # Create screen metadata
    screen = ScreenMetadata(
        width=image_width,
        height=image_height,
        timestamp=datetime.utcnow().isoformat() + "Z",
        hash=compute_screen_hash(image_bytes),
        url=url,
        title=title,
    )
    
    return UIMap(
        screen=screen,
        elements=elements,
        parserVersion="omniparser-v1",
    )

