# UI LLM OmniParser - AI UI Automation Framework

An internal AI-driven UI automation framework focusing on self-healing, low-cost, vision-based testing.

## Overview

This framework uses a YOLO-style perception layer (starting with OmniParser) to locally detect and understand UI elements from screenshots, producing a structured UI map that the test runner can act on deterministically. An LLM is used only as a constrained fallback planner, keeping token usage low.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Test Runner CLI                              │
│  ┌──────────┐  ┌──────────────┐  ┌─────────────┐  ┌──────────────┐ │
│  │ Commands │  │ Playwright   │  │  Healing    │  │  Trajectory  │ │
│  │ run/rec  │  │ Executor     │  │  Engine     │  │  Logger      │ │
│  └──────────┘  └──────────────┘  └─────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      Perception Service                              │
│  ┌──────────────────┐    ┌──────────────────┐                       │
│  │   OmniParser     │───▶│   UIMap Gen      │                       │
│  └──────────────────┘    └──────────────────┘                       │
└─────────────────────────────────────────────────────────────────────┘
```

## Packages

- **@ui-automation/shared** - Shared TypeScript schemas (UIMap, Actions, Trajectories)
- **@ui-automation/runner** - Test runner CLI with Playwright executor
- **packages/perception** - Python FastAPI service wrapping OmniParser
- **packages/test-app** - Poker admin panel React app for testing

## Quick Start

### Prerequisites

- Node.js >= 18
- pnpm >= 8
- Python 3.11+

### Installation

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build
```

### Running the Test App

```bash
# Start the poker admin panel
cd packages/test-app
pnpm dev
```

### Running the Perception Service

```bash
# Using Docker
cd packages/perception
docker build -t perception-service .
docker run -p 8000:8000 perception-service

# Or locally with Python
cd packages/perception
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn src.server:app --reload
```

### Running Tests

```bash
# Run a test suite
cd packages/runner
pnpm start run --test ../../examples/tests/login.test.yaml
```

## Step-by-Step Usage Guide

### 1. Start the Test App (Target Application)

```bash
cd packages/test-app
pnpm dev
```

The poker admin panel will be available at **http://localhost:3000**

### 2. Start the Perception Service

In a new terminal:

```bash
cd packages/perception

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Start the server
uvicorn src.server:app --reload --port 8000
```

The perception API will be available at **http://localhost:8000**

### 3. Run Test Suites

In a new terminal:

```bash
cd packages/runner

# Run login test with browser visible
pnpm start run --test ../../examples/tests/login.test.yaml --no-headless

# Run player search test
pnpm start run --test ../../examples/tests/player-search.test.yaml --no-headless

# Run tournament creation test
pnpm start run --test ../../examples/tests/tournament-create.test.yaml --no-headless

# Run in headless mode (faster, no browser window)
pnpm start run --test ../../examples/tests/login.test.yaml

# Verbose output
pnpm start run --test ../../examples/tests/login.test.yaml --verbose
```

### 4. View Trajectories

After running tests, trajectories are saved to the `trajectories/` directory:

```bash
# List all trajectory runs
cd packages/runner
pnpm start list-trajectories

# Trajectories contain:
# - screenshots/ (before/after each step)
# - entries/ (individual step data)
# - trajectory.json (complete run log)
# - metadata.json (run info)
```

## CLI Commands Reference

```bash
ui-runner run [options]          # Run a test suite
  -t, --test <path>              # Path to test file (required)
  --headless                     # Run in headless mode (default: true)
  --no-headless                  # Show browser window
  -b, --browser <browser>        # chromium | firefox | webkit
  --base-url <url>               # Override base URL
  --perception-url <url>         # Perception service URL (default: http://localhost:8000)
  -o, --output-dir <dir>         # Trajectory output directory
  -v, --verbose                  # Verbose output

ui-runner record [options]       # Record manual testing (Phase 2)
ui-runner replay [options]       # Replay a trajectory (Phase 2)
ui-runner list-trajectories      # List all recorded runs
```

## Test File Format

Test suites are defined in YAML:

```yaml
metadata:
  name: My Test Suite
  description: Description of the test
  environment:
    baseUrl: http://localhost:3000
    viewport:
      width: 1920
      height: 1080

setup:
  - name: Setup step
    actions:
      - type: NAVIGATE
        url: http://localhost:3000

steps:
  - name: Click button
    actions:
      - type: CLICK
        target: E001
      - type: ASSERT
        predicate:
          kind: TEXT_EXISTS
          value: Success

teardown:
  - name: Cleanup
    actions:
      - type: CLICK
        target: E025
```

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
| `TITLE_CONTAINS` | Page title contains value |

## Key Concepts

### UIMap

A structured representation of UI elements detected in a screenshot:

```json
{
  "screen": { "width": 1920, "height": 1080, "timestamp": "...", "hash": "..." },
  "elements": [
    {
      "id": "E12",
      "bbox": [100, 200, 150, 40],
      "role": "button",
      "text": "Submit",
      "confidence": 0.92,
      "interactable": true
    }
  ]
}
```

### Self-Healing

The framework automatically heals broken element references by:
1. Text/caption similarity matching
2. Role matching
3. Approximate bbox proximity
4. Neighbor anchor constraints

### Trajectory Logging

Every test step records:
- Before/after screenshots
- UIMap state
- Action performed
- Result and timing
- Healing events

## OmniParser Integration

The framework supports real UI element detection using Microsoft's OmniParser.

### Quick Setup

```bash
# 1. Install full dependencies
cd packages/perception
pip install -r requirements-full.txt

# 2. Download model weights (optional - falls back to YOLO + OCR)
mkdir -p models/icon_detect
# Download from: https://huggingface.co/microsoft/OmniParser

# 3. Run with real detection
USE_MOCK_PARSER=false uvicorn src.server:app --port 8000
```

### How It Works

```
Screenshot → YOLO Detection → Bounding Boxes
                           ↓
                    EasyOCR (text)
                           ↓
                    UIMap JSON
```

### Configuration

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `USE_MOCK_PARSER` | `true` | Use mock parser for testing |
| `OMNIPARSER_MODEL_PATH` | `models/` | Path to model weights |
| `OMNIPARSER_DEVICE` | `auto` | `cuda`, `cpu`, or `auto` |

See [OMNIPARSER_INTEGRATION.md](packages/perception/OMNIPARSER_INTEGRATION.md) for detailed setup instructions.

## License

Internal use only.

