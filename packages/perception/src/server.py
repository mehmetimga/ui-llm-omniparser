"""
FastAPI server for the Perception Service
"""

import base64
import io
import logging
import os
from typing import Any, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from PIL import Image

from .parser import get_parser
from .ui_map import create_ui_map, UIMap

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="Perception Service",
    description="UI element detection service using OmniParser",
    version="0.1.0",
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, restrict to specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize parser
USE_MOCK = os.getenv("USE_MOCK_PARSER", "true").lower() == "true"
MODEL_PATH = os.getenv("OMNIPARSER_MODEL_PATH", None)
parser = get_parser(use_mock=USE_MOCK, model_path=MODEL_PATH)


class ParseRequestMetadata(BaseModel):
    """Metadata for parse request"""
    test_id: Optional[str] = None
    env: Optional[str] = None
    step_name: Optional[str] = None


class ParseRequest(BaseModel):
    """Request body for /parse endpoint"""
    image_base64: str
    metadata: Optional[ParseRequestMetadata] = None


class HealthResponse(BaseModel):
    """Response for /health endpoint"""
    status: str
    version: str
    parser: str


@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""
    return HealthResponse(
        status="ok",
        version="0.1.0",
        parser="mock" if USE_MOCK else "omniparser",
    )


@app.post("/parse", response_model=UIMap)
async def parse_screenshot(request: ParseRequest):
    """
    Parse a screenshot and return UIMap with detected elements.
    
    Args:
        request: ParseRequest with base64 encoded image
        
    Returns:
        UIMap with detected UI elements
    """
    try:
        # Decode base64 image
        try:
            image_bytes = base64.b64decode(request.image_base64)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid base64 image: {e}")
        
        # Load image with PIL
        try:
            image = Image.open(io.BytesIO(image_bytes))
            image = image.convert("RGB")  # Ensure RGB format
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid image format: {e}")
        
        width, height = image.size
        logger.info(f"Processing image: {width}x{height}")
        
        # Log metadata if provided
        if request.metadata:
            logger.info(
                f"Request metadata - test_id: {request.metadata.test_id}, "
                f"env: {request.metadata.env}, step: {request.metadata.step_name}"
            )
        
        # Run parser
        detections = parser.parse(image)
        logger.info(f"Detected {len(detections)} elements")
        
        # Create UIMap
        ui_map = create_ui_map(
            detections=detections,
            image_width=width,
            image_height=height,
            image_bytes=image_bytes,
        )
        
        return ui_map
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error parsing screenshot: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal error: {e}")


@app.get("/")
async def root():
    """Root endpoint with service info"""
    return {
        "service": "Perception Service",
        "version": "0.1.0",
        "endpoints": {
            "/health": "Health check",
            "/parse": "Parse screenshot (POST)",
        },
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

