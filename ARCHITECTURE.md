# Architecture Documentation

This document provides a detailed overview of the UI LLM OmniParser architecture, components, and data flow.

## Table of Contents

- [System Overview](#system-overview)
- [Component Architecture](#component-architecture)
- [Data Flow](#data-flow)
- [Perception Service](#perception-service)
- [Test Runner](#test-runner)
- [UIMap Schema](#uimap-schema)
- [LLaVA Integration](#llava-integration)
- [Self-Healing System](#self-healing-system)
- [Trajectory System](#trajectory-system)

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              User Interface                                  │
│                                                                              │
│   ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐        │
│   │  Test YAML      │    │  CLI Commands   │    │  Trajectories   │        │
│   │  Definition     │───▶│  (run, record)  │───▶│  Output         │        │
│   └─────────────────┘    └─────────────────┘    └─────────────────┘        │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Test Runner (Node.js)                              │
│                                                                              │
│   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐       │
│   │   YAML      │  │ Playwright  │  │  Healing    │  │   Drift     │       │
│   │   Parser    │  │  Executor   │  │  Engine     │  │  Detector   │       │
│   └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘       │
│          │                │                │                │               │
│          └────────────────┴────────────────┴────────────────┘               │
│                                    │                                         │
│                           ┌─────────────┐                                   │
│                           │ Trajectory  │                                   │
│                           │   Logger    │                                   │
│                           └─────────────┘                                   │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ HTTP (Screenshots)
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        Perception Service (Python)                           │
│                                                                              │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                          FastAPI Server                              │   │
│   │                                                                      │   │
│   │  POST /parse    ─────▶  OmniParser  ─────▶  UIMap Response          │   │
│   │  GET  /health   ─────▶  Status Check                                │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                         │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                         OmniParser Core                              │   │
│   │                                                                      │   │
│   │  ┌─────────────┐      ┌─────────────────────────────────────────┐   │   │
│   │  │    YOLO     │      │           Text Extraction                │   │   │
│   │  │  Detector   │      │                                          │   │   │
│   │  │             │      │  ┌─────────────┐    ┌─────────────────┐  │   │   │
│   │  │  YOLOv8n    │─────▶│  │  EasyOCR    │ OR │     LLaVA       │  │   │   │
│   │  │  (2.4 MB)   │      │  │  (Default)  │    │  (via Ollama)   │  │   │   │
│   │  └─────────────┘      │  └─────────────┘    └─────────────────┘  │   │   │
│   │                       └─────────────────────────────────────────┘   │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ HTTP (Vision API)
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Ollama (Local LLM Server)                          │
│                                                                              │
│   ┌───────────────┐   ┌───────────────┐   ┌───────────────┐                │
│   │  llava-phi3   │   │    llava      │   │  llava:13b    │                │
│   │   (2.9 GB)    │   │   (4.7 GB)    │   │   (8.0 GB)    │                │
│   │               │   │               │   │               │                │
│   │  Phi-3 + CLIP │   │ LLaMA + CLIP  │   │ LLaMA + CLIP  │                │
│   │  Fast, Good   │   │ Balanced      │   │ Best Accuracy │                │
│   └───────────────┘   └───────────────┘   └───────────────┘                │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Component Architecture

### 1. Test Runner (`packages/runner`)

The test runner is the main orchestration layer built with TypeScript.

```
packages/runner/
├── src/
│   ├── cli/
│   │   ├── index.ts           # CLI entry point
│   │   └── commands/
│   │       └── run.ts         # Main run command
│   │
│   ├── executor/
│   │   └── playwright.ts      # Browser automation
│   │
│   ├── healing/
│   │   └── engine.ts          # Self-healing logic
│   │
│   ├── drift/
│   │   └── detector.ts        # UI drift detection
│   │
│   ├── perception/
│   │   └── client.ts          # Perception API client
│   │
│   ├── planner/
│   │   └── llm.ts             # LLM fallback planner
│   │
│   └── logger/
│       └── trajectory.ts      # Test trajectory logging
```

#### Key Classes

**PlaywrightExecutor** (`executor/playwright.ts`)
- Manages browser lifecycle via Playwright
- Executes test actions (click, type, navigate, etc.)
- Takes screenshots for perception
- Supports multiple target selector types:
  - `text:` - OCR-detected text matching
  - `selector:` / `css:` - CSS selectors
  - `xpath:` - XPath expressions
  - `locator:` - Playwright's getByRole
  - `label:` - Playwright's getByLabel
  - `E###` - UIMap element IDs

**HealingEngine** (`healing/engine.ts`)
- Creates element signatures for matching
- Resolves broken element references
- Uses text similarity, role matching, bbox proximity

**DriftDetector** (`drift/detector.ts`)
- Compares UIMap states between steps
- Detects element count changes, layout shifts
- Alerts on significant UI changes

### 2. Perception Service (`packages/perception`)

Python FastAPI service for visual UI understanding.

```
packages/perception/
├── src/
│   ├── server.py              # FastAPI endpoints
│   ├── parser.py              # Parser factory
│   ├── omniparser_real.py     # YOLO + OCR/LLaVA integration
│   ├── llava_vision.py        # LLaVA API client
│   └── ui_map.py              # UIMap generation
│
├── requirements.txt           # Core dependencies
└── requirements-full.txt      # Full deps (YOLO, OCR)
```

#### Processing Pipeline

```
Screenshot (PNG/Base64)
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│                    Image Processing                      │
│                                                          │
│  1. Decode base64 → PIL Image                           │
│  2. Convert to RGB                                       │
│  3. Resize if needed                                     │
└─────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│                   YOLO Detection                         │
│                                                          │
│  • YOLOv8n model (pretrained or custom)                 │
│  • Outputs bounding boxes for UI elements               │
│  • Confidence threshold filtering                        │
└─────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│                  Text Extraction                         │
│                                                          │
│  Option A: EasyOCR (Default)                            │
│  • Per-region OCR                                        │
│  • Fast, ~50ms per region                               │
│                                                          │
│  Option B: LLaVA (via Ollama)                           │
│  • Full-screen text analysis                            │
│  • Better accuracy, ~5-20s per image                    │
│  • Understands UI context                               │
└─────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│                  UIMap Generation                        │
│                                                          │
│  • Assign element IDs (E001, E002, ...)                 │
│  • Calculate center coordinates                          │
│  • Determine element roles                              │
│  • Package as JSON response                             │
└─────────────────────────────────────────────────────────┘
```

### 3. Shared Schemas (`packages/shared`)

TypeScript/Zod schemas shared between packages.

```
packages/shared/
└── src/
    └── schemas/
        ├── action.ts          # Test actions & assertions
        ├── ui-map.ts          # UIMap types
        └── trajectory.ts      # Trajectory logging types
```

## Data Flow

### Test Execution Flow

```
1. Load Test YAML
   │
   ├── Parse metadata (name, environment, viewport)
   ├── Parse setup steps
   ├── Parse test steps
   └── Parse teardown steps
   
2. Initialize Browser
   │
   ├── Launch Playwright (chromium/firefox/webkit)
   ├── Set viewport size
   └── Create browser context

3. For Each Step:
   │
   ├─► Take Screenshot
   │      │
   │      ▼
   │   Send to Perception Service
   │      │
   │      ▼
   │   Receive UIMap
   │      │
   │      ▼
   │   Execute Actions
   │      │
   │      ├── CLICK → Find element → Click coordinates
   │      ├── TYPE → Find element → Fill text
   │      ├── ASSERT → Check predicate → Pass/Fail
   │      └── ... other actions
   │      │
   │      ▼
   │   Log to Trajectory
   │      │
   │      ├── Before UIMap
   │      ├── After UIMap
   │      ├── Action details
   │      ├── Screenshots
   │      └── Timing info
   │
   └─► Check for Drift
          │
          ▼
       Alert if significant changes

4. Generate Summary
   │
   ├── Total steps passed/failed
   ├── Healing events
   ├── Drift alerts
   └── Save trajectory
```

### API Request/Response

**POST /parse**

Request:
```json
{
  "image_base64": "iVBORw0KGgo...",
  "metadata": {
    "test_id": "run_abc123",
    "step_name": "Login"
  }
}
```

Response:
```json
{
  "screen": {
    "width": 1920,
    "height": 1080,
    "timestamp": "2024-01-15T10:30:00Z",
    "hash": "abc123..."
  },
  "elements": [
    {
      "id": "E001",
      "boundingBox": {
        "x": 960,
        "y": 540,
        "width": 120,
        "height": 40
      },
      "role": "button",
      "text": "Sign In",
      "caption": "Blue login button",
      "confidence": 0.95,
      "interactable": true
    }
  ],
  "parserVersion": "llava:13b"
}
```

## LLaVA Integration

### How LLaVA Works

LLaVA (Large Language and Vision Assistant) is a multimodal model that can understand both images and text.

```
┌─────────────────────────────────────────────────────────────────┐
│                         LLaVA Architecture                       │
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐       │
│  │    CLIP      │    │   Projector  │    │   LLaMA      │       │
│  │   Vision     │───▶│    Layer     │───▶│   Language   │       │
│  │   Encoder    │    │              │    │    Model     │       │
│  └──────────────┘    └──────────────┘    └──────────────┘       │
│        │                                        │                │
│   Image Input                              Text Output           │
│                                                                  │
│  "What text do you see?"    →    "I see: Sign In, Email..."    │
└─────────────────────────────────────────────────────────────────┘
```

### LLaVA vs EasyOCR

| Feature | EasyOCR | LLaVA |
|---------|---------|-------|
| Speed | ~50ms/region | ~5-20s/image |
| Accuracy | Good for clear text | Better overall |
| Context | None | Understands UI semantics |
| Element Types | Text only | Identifies buttons, inputs |
| Hallucination | None | Possible |
| Resource Usage | Low (CPU) | High (GPU/RAM) |

### LLaVA Prompt Engineering

The perception service uses a carefully crafted prompt:

```python
prompt = """You are a UI analyzer. Examine this screenshot and list 
EVERY visible text element, including:
- Headings and titles
- Button text
- Input field labels (like "Email", "Password", "Username")
- Links and navigation items
- Placeholder text
- Small text and captions

For each text element provide:
- text: exact text content
- position: location (top-left, center, etc.)
- type: element type (heading, button, label, input, link, text)

IMPORTANT: Include ALL text you can see, even small labels.

Return as JSON array only:
[{"text": "Sign In", "position": "center", "type": "button"}]"""
```

## Self-Healing System

### Element Matching Strategy

When an element reference breaks, the healing engine attempts resolution:

```
Original Target: E015 (not found in current UIMap)
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Healing Resolution                           │
│                                                                  │
│  1. Text Similarity (highest weight)                            │
│     └── Compare text/caption with Levenshtein distance          │
│                                                                  │
│  2. Role Matching                                                │
│     └── Same role type (button, input, link)                    │
│                                                                  │
│  3. BBox Proximity                                               │
│     └── Within threshold pixels of original position            │
│                                                                  │
│  4. Neighbor Constraints                                         │
│     └── Check relative positions to known anchors               │
└─────────────────────────────────────────────────────────────────┘
         │
         ▼
    Best Match: E023 (confidence: 0.87)
```

### Signature Creation

```typescript
interface ElementMatcher {
  id: string;
  text?: string;
  caption?: string;
  role: string;
  bbox: BoundingBox;
  neighbors: {
    above?: string;
    below?: string;
    left?: string;
    right?: string;
  };
}
```

## Trajectory System

### Structure

```
trajectories/
└── run_abc123_xyz789/
    ├── metadata.json          # Run configuration
    ├── trajectory.json        # Complete log
    ├── screenshots/
    │   ├── step_0_before.png
    │   ├── step_0_after.png
    │   ├── step_1_before.png
    │   └── ...
    └── entries/
        ├── step_0.json
        ├── step_1.json
        └── ...
```

### Entry Schema

```json
{
  "stepIndex": 0,
  "stepName": "Navigate to login",
  "timestamp": "2024-01-15T10:30:00Z",
  "duration": 1523,
  "status": "passed",
  "actions": [
    {
      "type": "NAVIGATE",
      "url": "http://localhost:3000",
      "result": "success"
    }
  ],
  "beforeUIMap": { ... },
  "afterUIMap": { ... },
  "healingEvents": [],
  "driftAlerts": []
}
```

## Performance Considerations

### Optimization Tips

1. **Use llava-phi3 for development**
   - 3x faster than llava:13b
   - Good enough for most UI detection

2. **Reduce screenshot frequency**
   - Only capture when needed
   - Cache UIMap between unchanged states

3. **Use CSS selectors when possible**
   - `selector:button[type="submit"]` is instant
   - No perception service call needed

4. **Batch assertions**
   - Multiple TEXT_EXISTS in one step shares the UIMap

### Resource Requirements

| Component | CPU | RAM | GPU |
|-----------|-----|-----|-----|
| Test Runner | Low | 512MB | None |
| Perception (EasyOCR) | Medium | 2GB | Optional |
| Perception (LLaVA) | Medium | 4GB | Recommended |
| Ollama (llava-phi3) | High | 4GB | 4GB VRAM |
| Ollama (llava:13b) | High | 10GB | 8GB VRAM |

## Security Considerations

- **Local-only processing**: All vision processing runs locally
- **No cloud dependencies**: LLaVA runs via Ollama on your machine
- **Sandboxed browser**: Playwright runs in isolated context
- **No credentials in UIMap**: OCR results may capture sensitive text

## Extending the Framework

### Adding New Actions

1. Add to action schema (`packages/shared/src/schemas/action.ts`)
2. Implement in executor (`packages/runner/src/executor/playwright.ts`)
3. Update documentation

### Adding New Vision Backends

1. Create adapter in `packages/perception/src/`
2. Implement the `parse(image) -> detections` interface
3. Register in `parser.py` factory

### Custom YOLO Models

1. Train on UI-specific dataset
2. Export as `.pt` file
3. Place in `models/icon_detect/model.pt`
4. Disable mock parser: `USE_MOCK_PARSER=false`

