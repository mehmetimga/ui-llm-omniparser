# UI LLM OmniParser - AI UI Automation Framework

An internal AI-driven UI automation framework focusing on self-healing, low-cost, vision-based testing.

## Overview

This framework uses a vision-based perception layer to locally detect and understand UI elements from screenshots, producing a structured UI map that the test runner can act on deterministically. It supports multiple vision backends:

- **YOLO + EasyOCR** - Fast, lightweight detection
- **YOLO + LLaVA** - More accurate text extraction via Vision Language Model (recommended)

An LLM is used only as a constrained fallback planner, keeping token usage low.

## Quick Start

### Prerequisites

- Node.js >= 18
- pnpm >= 8
- Python 3.11+
- [Ollama](https://ollama.com) (for LLaVA integration)

### Installation

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Install Python dependencies
cd packages/perception
pip install -r requirements.txt
pip install -r requirements-full.txt  # For YOLO + OCR
```

### Setup LLaVA (Recommended)

```bash
# Install Ollama (macOS)
brew install ollama

# Start Ollama service
ollama serve

# Pull LLaVA model (choose one)
ollama pull llava-phi3    # 2.9 GB - Fast, good accuracy
ollama pull llava:13b     # 8.0 GB - Best accuracy, slower
```

### Run Everything

**Terminal 1 - Test Application:**
```bash
cd packages/test-app
pnpm dev
# → http://localhost:3000
```

**Terminal 2 - Perception Service:**
```bash
cd packages/perception

# With LLaVA (recommended)
USE_MOCK_PARSER=false USE_LLAVA=true LLAVA_MODEL=llava-phi3 \
  python -m uvicorn src.server:app --port 8000

# Or with EasyOCR
USE_MOCK_PARSER=false \
  python -m uvicorn src.server:app --port 8000
```

**Terminal 3 - Run Tests:**
```bash
cd packages/runner

# Run login test with visible browser
pnpm start run --test ../../examples/tests/login.test.yaml --no-headless --verbose
```

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Test Runner CLI                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐  ┌──────────────┐  │
│  │   Commands   │  │  Playwright  │  │   Healing   │  │  Trajectory  │  │
│  │   run/rec    │  │   Executor   │  │   Engine    │  │    Logger    │  │
│  └──────────────┘  └──────────────┘  └─────────────┘  └──────────────┘  │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │ Screenshots
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                       Perception Service (FastAPI)                       │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                         OmniParser                                │   │
│  │  ┌────────────┐    ┌─────────────────────────────────────────┐   │   │
│  │  │   YOLO     │───▶│         Text Extraction                  │   │   │
│  │  │ Detection  │    │  ┌─────────────┐  ┌─────────────────┐   │   │   │
│  │  └────────────┘    │  │  EasyOCR    │  │     LLaVA       │   │   │   │
│  │                    │  │  (default)  │  │  (via Ollama)   │   │   │   │
│  │                    │  └─────────────┘  └─────────────────┘   │   │   │
│  │                    └─────────────────────────────────────────┘   │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                 │                                        │
│                                 ▼                                        │
│                          ┌─────────────┐                                │
│                          │   UIMap     │                                │
│                          │  Generator  │                                │
│                          └─────────────┘                                │
└─────────────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           Ollama (Local)                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐         │
│  │   llava-phi3    │  │    llava:7b     │  │   llava:13b     │         │
│  │    (2.9 GB)     │  │    (4.7 GB)     │  │    (8.0 GB)     │         │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘         │
└─────────────────────────────────────────────────────────────────────────┘
```

See [ARCHITECTURE.md](ARCHITECTURE.md) for detailed architecture documentation.

## Packages

| Package | Description |
|---------|-------------|
| `@ui-automation/shared` | Shared TypeScript schemas (UIMap, Actions, Trajectories) |
| `@ui-automation/runner` | Test runner CLI with Playwright executor |
| `packages/perception` | Python FastAPI service with YOLO + LLaVA/OCR |
| `packages/test-app` | Poker admin panel React app for testing |

## Configuration

### Perception Service Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `USE_MOCK_PARSER` | `true` | Use mock parser (for development) |
| `USE_LLAVA` | `false` | Use LLaVA for OCR instead of EasyOCR |
| `LLAVA_MODEL` | `llava` | LLaVA model: `llava-phi3`, `llava`, `llava:13b` |
| `OLLAMA_URL` | `http://localhost:11434` | Ollama API URL |
| `OMNIPARSER_MODEL_PATH` | `models/` | Path to YOLO model weights |

### LLaVA Model Comparison

| Model | Size | Speed | Accuracy | Best For |
|-------|------|-------|----------|----------|
| `llava-phi3` | 2.9 GB | ~5-7s | Good | Development, fast iteration |
| `llava` | 4.7 GB | ~10s | Better | General use |
| `llava:13b` | 8.0 GB | ~15-20s | Best | Production, accuracy-critical |

## CLI Commands

```bash
# Run a test suite
pnpm start run --test <path> [options]

Options:
  -t, --test <path>          Path to test YAML file (required)
  --headless                 Run in headless mode (default: true)
  --no-headless              Show browser window
  -b, --browser <browser>    chromium | firefox | webkit
  --base-url <url>           Override base URL
  --perception-url <url>     Perception service URL
  -o, --output-dir <dir>     Trajectory output directory
  -v, --verbose              Verbose output
```

## Test File Format

```yaml
metadata:
  name: Login Flow
  description: Tests user authentication
  environment:
    baseUrl: http://localhost:3000
    viewport:
      width: 1920
      height: 1080

steps:
  - name: Navigate to login
    actions:
      - type: NAVIGATE
        url: http://localhost:3000
      - type: WAIT
        ms: 1000
      - type: ASSERT
        predicate:
          kind: TEXT_EXISTS
          value: Sign In

  - name: Enter credentials
    actions:
      - type: CLICK
        target: selector:input[type="email"]
      - type: TYPE
        target: selector:input[type="email"]
        text: admin@example.com
      - type: CLICK
        target: locator:Sign In
```

### Target Selectors

| Prefix | Example | Description |
|--------|---------|-------------|
| `text:` | `text:Submit` | Find by OCR-detected text |
| `selector:` | `selector:input[type="email"]` | CSS selector |
| `xpath:` | `xpath://button` | XPath selector |
| `locator:` | `locator:Sign In` | Playwright getByRole |
| `label:` | `label:Email` | Playwright getByLabel |
| `E###` | `E001` | Element ID from UIMap |

### Available Actions

| Action | Parameters | Description |
|--------|------------|-------------|
| `CLICK` | `target` | Click an element |
| `DOUBLE_CLICK` | `target` | Double-click an element |
| `TYPE` | `target`, `text` | Type text into an input |
| `CLEAR` | `target` | Clear an input field |
| `HOVER` | `target` | Hover over an element |
| `SELECT` | `target`, `option` | Select dropdown option |
| `SCROLL` | `direction`, `amount` | Scroll the page |
| `WAIT` | `ms` | Wait for milliseconds |
| `ASSERT` | `predicate` | Assert a condition |
| `NAVIGATE` | `url` | Navigate to URL |
| `PRESS_KEY` | `key` | Press keyboard key |

### Assertion Predicates

| Kind | Description |
|------|-------------|
| `TEXT_EXISTS` | Text is present on page |
| `TEXT_NOT_EXISTS` | Text is not present |
| `ELEMENT_EXISTS` | Element ID exists in UIMap |
| `URL_CONTAINS` | URL contains value |
| `URL_NOT_CONTAINS` | URL does not contain value |
| `TITLE_CONTAINS` | Page title contains value |

## Key Features

### Vision-Based Element Detection

Screenshots are processed through YOLO for bounding box detection and LLaVA/EasyOCR for text extraction, producing a structured UIMap:

```json
{
  "screen": { "width": 1920, "height": 1080 },
  "elements": [
    {
      "id": "E001",
      "boundingBox": { "x": 100, "y": 200, "width": 150, "height": 40 },
      "role": "button",
      "text": "Sign In",
      "confidence": 0.92
    }
  ]
}
```

### Self-Healing

The framework automatically heals broken element references by:
1. Text/caption similarity matching
2. Role matching
3. Approximate bounding box proximity
4. Neighbor anchor constraints

### Drift Detection

Alerts you when UI changes between test runs:
- Element count changes
- Layout shifts
- New/removed elements

### Trajectory Logging

Every test step records:
- Before/after screenshots
- UIMap state
- Action performed
- Result and timing
- Healing events

## Example Test Output

```
✔ Perception service ready (omniparser)

📋 Test Run: run_abc123

▶ Running test steps...
✔ Navigate to login page (20s)
✔ Verify login form elements (26s)
✔ Enter credentials and click Sign In (15s)
✔ Verify successful login (43s)
✔ Logout (45s)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Test Summary
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total Steps: 5
Passed: 5
Failed: 0
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Documentation

- [ARCHITECTURE.md](ARCHITECTURE.md) - Detailed system architecture
- [packages/perception/OMNIPARSER_INTEGRATION.md](packages/perception/OMNIPARSER_INTEGRATION.md) - OmniParser setup guide

## License

Internal use only.
