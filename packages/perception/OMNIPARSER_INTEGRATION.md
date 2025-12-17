# OmniParser Integration Guide

This guide explains how to integrate Microsoft's OmniParser for real UI element detection.

## Overview

OmniParser is a vision-based UI understanding system that:
1. **Detects UI elements** using a YOLO-based model
2. **Extracts text** using OCR (EasyOCR or PaddleOCR)
3. **Generates captions** using a vision-language model (Florence-2 or BLIP-2)

## Prerequisites

### Hardware Requirements
- **GPU recommended**: NVIDIA GPU with 8GB+ VRAM for best performance
- **CPU fallback**: Works but slower (10-30 seconds per image vs 1-3 seconds on GPU)
- **RAM**: 16GB+ recommended

### Software Requirements
- Python 3.10 or 3.11 (not 3.12+ due to compatibility)
- CUDA 11.8+ (for GPU acceleration)
- Git LFS (for downloading model weights)

## Installation

### Option 1: Using OmniParser from Source (Recommended)

```bash
# 1. Clone OmniParser repository
git clone https://github.com/microsoft/OmniParser.git
cd OmniParser

# 2. Install dependencies
pip install -r requirements.txt

# 3. Download model weights (using Git LFS)
git lfs install
git lfs pull

# Or manually download from HuggingFace:
# - Icon detection: https://huggingface.co/microsoft/OmniParser/tree/main
# - Download icon_detect/ and icon_caption_florence/ folders
```

### Option 2: Using HuggingFace Transformers

```bash
pip install torch torchvision
pip install transformers
pip install easyocr
pip install ultralytics  # For YOLO
```

## Model Weights

Download the following models:

| Model | Purpose | Size | Link |
|-------|---------|------|------|
| `icon_detect/` | UI element detection (YOLO) | ~50MB | [HuggingFace](https://huggingface.co/microsoft/OmniParser) |
| `icon_caption_florence/` | Element captioning | ~1GB | [HuggingFace](https://huggingface.co/microsoft/OmniParser) |

Place models in: `packages/perception/models/`

```
packages/perception/
├── models/
│   ├── icon_detect/
│   │   └── model.pt
│   └── icon_caption_florence/
│       ├── config.json
│       └── pytorch_model.bin
├── src/
│   └── ...
```

## Configuration

### Environment Variables

```bash
# In .env or export:
export USE_MOCK_PARSER=false
export OMNIPARSER_MODEL_PATH=/path/to/models
export OMNIPARSER_DEVICE=cuda  # or 'cpu'
export OMNIPARSER_CONFIDENCE_THRESHOLD=0.5
```

### Updated requirements.txt

```txt
# Core
fastapi==0.109.0
uvicorn[standard]==0.27.0
python-multipart==0.0.6
Pillow==10.2.0
numpy==1.26.3
pydantic==2.5.3
httpx==0.26.0

# OmniParser dependencies
torch>=2.0.0
torchvision>=0.15.0
transformers>=4.36.0
ultralytics>=8.0.0
easyocr>=1.7.0
supervision>=0.16.0
```

## Integration Code

The integration is already prepared in `src/parser.py`. Here's what happens:

### 1. Detection Pipeline

```python
# OmniParser detection flow:
image → YOLO Detection → Bounding Boxes
                      ↓
              OCR (text extraction)
                      ↓
           Florence-2 (captioning)
                      ↓
                   UIMap
```

### 2. Enable Real Parser

Update `src/server.py`:

```python
# Change this:
USE_MOCK = os.getenv("USE_MOCK_PARSER", "true").lower() == "true"

# To this:
USE_MOCK = os.getenv("USE_MOCK_PARSER", "false").lower() == "true"
```

## Usage

### Start with GPU

```bash
cd packages/perception
source venv/bin/activate
USE_MOCK_PARSER=false OMNIPARSER_DEVICE=cuda uvicorn src.server:app --port 8000
```

### Start with CPU (slower)

```bash
USE_MOCK_PARSER=false OMNIPARSER_DEVICE=cpu uvicorn src.server:app --port 8000
```

## API Response

With real OmniParser, you'll get actual UI elements:

```json
{
  "screen": {
    "width": 1920,
    "height": 1080,
    "timestamp": "2024-03-17T12:00:00Z",
    "hash": "abc123..."
  },
  "elements": [
    {
      "id": "E000",
      "bbox": [340, 520, 500, 560],
      "role": "input",
      "text": "admin@poker.com",
      "caption": "email input field with placeholder text",
      "confidence": 0.94,
      "interactable": true,
      "neighbors": {...}
    },
    {
      "id": "E001",
      "bbox": [340, 580, 500, 620],
      "role": "input",
      "text": "",
      "caption": "password input field",
      "confidence": 0.92,
      "interactable": true,
      "neighbors": {...}
    },
    {
      "id": "E002",
      "bbox": [340, 660, 500, 700],
      "role": "button",
      "text": "Sign In",
      "caption": "primary action button for login",
      "confidence": 0.96,
      "interactable": true,
      "neighbors": {...}
    }
  ]
}
```

## Performance Optimization

### 1. Batch Processing
Process multiple screenshots in parallel for efficiency.

### 2. Model Caching
Models are loaded once at startup and cached in memory.

### 3. Resolution Scaling
For faster processing, scale images to 1280x720 before detection.

### 4. Selective Captioning
Only caption interactable elements to save time.

## Troubleshooting

### CUDA Out of Memory
```bash
# Reduce batch size or use CPU
export OMNIPARSER_DEVICE=cpu
```

### Slow Performance
- Use GPU if available
- Scale down input images
- Disable captioning for non-interactable elements

### Model Not Found
```bash
# Verify model paths
ls -la packages/perception/models/icon_detect/
ls -la packages/perception/models/icon_caption_florence/
```

## Alternative Parsers

If OmniParser doesn't fit your needs, the architecture supports swapping in:

1. **Custom YOLO Model**: Train on your specific UI
2. **Grounding DINO**: Zero-shot detection
3. **SAM + OCR**: Segment Anything + text extraction
4. **GPT-4V API**: Cloud-based parsing (higher cost)

## Next Steps

1. Download model weights
2. Set `USE_MOCK_PARSER=false`
3. Run tests with real detection
4. Fine-tune confidence thresholds
5. Consider training custom YOLO on your UI patterns

