You are building an internal AI-driven UI automation framework for your online game company that focuses on self-healing, low-cost, vision-based testing rather than fragile selectors. The system uses a YOLO-style perception layer (starting with OmniParser, replaceable later) to locally detect and understand UI elements from screenshots, producing a structured UI map that the test runner can act on deterministically. An LLM is used only as a constrained fallback planner, invoked when screens are unknown or healing fails, keeping token usage low. While you manually test admin and game UIs, the framework records trajectories (screens, parsed elements, actions, outcomes) to automatically generate replayable tests and training data. Over time, it reduces flakiness by self-healing element changes, detects unexpected UI drift, and progressively replaces LLM reasoning with templates, retrieval, and learned models, giving you a scalable, internal-only, future-proof automation platform that can later transition fully to a custom YOLO detector if needed.



# AI UI Automation Framework — Phase 1 & Phase 2 Prompt Plan (Cursor)

Owner: Internal QA/Engineering  
Scope: Internal admin/backoffice tools + (optionally) game UI in controlled environments  
Primary goals:
- Self-healing UI automation
- “Train while I test manually” via trajectory logging
- Reduce LLM cost by using vision detection (OmniParser now; YOLO later if needed)

Non-goals (Phase 1–2):
- Full autonomous agent for arbitrary apps
- External third-party access
- Fine-tuning LLMs
- Perfect generalization across all UIs

---

## High-level Architecture

### Components
1. **Test Runner (CLI)**
   - Runs suites, steps, assertions
   - Calls Perception service for screen parsing
   - Executes actions through an Executor (Playwright/Appium/Desktop driver)
   - Logs trajectories and artifacts

2. **Perception Service**
   - Phase 1: OmniParser-based parser (local inference; models downloaded once)
   - Returns a normalized **UIMap** schema

3. **Planner**
   - Phase 1: Minimal LLM planner with strict JSON schema, called only when needed
   - Phase 2: “LLM-gated” planner + deterministic templates + retrieval for known screens

4. **Healing Engine**
   - Matches expected elements to current UIMap using signatures + anchors
   - Emits “healing events” and updates mappings

5. **Alerting / Drift Detector**
   - Detects unexpected UI changes (layout/text/element count) and fails tests with actionable diffs

6. **Trajectory Store**
   - File-based (Phase 1), then SQLite/Postgres (Phase 2)
   - Stores (state, uimap, action, result, after-state) for later training

### Key principle
- The LLM never clicks coordinates.
- It selects **element IDs** from UIMap, and the Executor applies the action.

---

## Data Contract: UIMap (must implement first)

### UIMap JSON Schema (v0)
```json
{
  "screen": {
    "width": 1920,
    "height": 1080,
    "timestamp": "2025-12-17T20:00:00Z",
    "hash": "sha256..."
  },
  "elements": [
    {
      "id": "E12",
      "bbox": [x, y, w, h],
      "role": "button|input|menu|icon|text|link|unknown",
      "text": "Submit",
      "caption": "submit button",
      "confidence": 0.92,
      "interactable": true,
      "neighbors": {
        "left": ["E10"],
        "right": ["E14"],
        "above": ["E08"],
        "below": ["E20"]
      }
    }
  ]
}


ElementSignature (used by Healing Engine)

semantic: text + caption + role

visual: optional embedding hash / crop reference

layout: normalized bbox + neighbor anchors

Phase 1 — MVP (Self-healing + Logging + Minimal LLM)
Objective

Deliver a working internal framework that:

Parses screens (OmniParser)

Executes test steps deterministically

Self-heals simple UI changes

Logs trajectories during manual + automated runs

Uses LLM only as fallback (unknown screens / ambiguous targets)

Deliverables

Perception Service (OmniParser)

Local Docker container or local process

Endpoint: POST /parse with screenshot bytes/base64

Response: UIMap v0

Test Runner CLI

run, record, replay

Test format: YAML or TypeScript DSL

Executor Adapter (choose one first)

Web admin tools: Playwright (recommended)

Optional later: Appium / desktop driver

Healing Engine v0

Locate expected element by:

text/caption similarity

role match

approximate bbox proximity

neighbor anchor constraints

If confidence < threshold:

mark step as “needs human”

capture snapshot + UIMap + candidate list

Drift Alerts v0

Alert on:

element count change > threshold

key anchor text changed

layout shift for anchors > threshold

Output a JSON diff + annotated screenshot (optional)

Trajectory Logging v0

Persist per step:

before screenshot

UIMap

action JSON

after screenshot

result + timing

healing events (if any)

Interfaces (implement exactly)
Perception API

POST /parse

request: { "image_base64": "...", "metadata": { "test_id": "...", "env": "stg" } }

response: UIMap v0

Action Schema (Planner → Runner)
{
  "steps": [
    { "type": "CLICK", "target": "E12" },
    { "type": "TYPE", "target": "E05", "text": "admin@example.com" },
    { "type": "WAIT", "ms": 800 },
    { "type": "ASSERT", "predicate": { "kind": "TEXT_EXISTS", "value": "Success" } }
  ]
}

Minimal LLM usage (Phase 1)

Only call LLM when:

target element cannot be resolved confidently

screen is “unknown state”

healing failed

LLM prompt must include:

goal

UIMap (truncated: top N interactables + nearby context)

allowed action schema only

Acceptance Criteria

Run 5–10 critical admin flows with:

= 80% step success without human intervention

healing resolves at least 1 intentional UI change (button moved/renamed)

logs produced and replayable

LLM calls are < 20% of steps in these flows

Engineering Tasks (Cursor worklist)

 Repo scaffold (monorepo): runner/, perception/, shared/, examples/

 Define UIMap + Action schemas in shared/

 Build Perception service wrapper around OmniParser (local)

 Runner CLI with Playwright executor

 Implement HealingEngine v0

 Implement DriftDetector v0

 Implement TrajectoryLogger v0 (filesystem)

 Add 3 example tests (login, user search, permissions change)

 Add CI job for lint/test (no external dependencies)

Guardrails (must implement)

Strict JSON schema validation for planner output

Max retries per step (e.g., 2)

“Safe click” verification (post-click screen hash change or expected assertion)

Redact secrets in logs (passwords, tokens)

Phase 2 — Cost Reduction + Retrieval + “Train While Testing” Workflow
Objective

Reduce LLM usage and improve robustness by:

deterministic templates for known screens

retrieval of prior successful trajectories

better self-healing via richer signatures

formal “record mode” for manual testing and auto-labeling

establish a clear path to YOLO training (optional)

Deliverables

Screen State Recognition

Compute screen embedding (cheap) + UIMap-based fingerprint

Classify known states (“LoginPage”, “UserSearch”, “ReportBuilder”)

Template Engine (Deterministic Policies)

For known states, execute without LLM

Templates refer to elements by:

anchor text patterns

role

relative layout

Retrieval Layer

Store successful trajectories keyed by:

screen fingerprint

environment/app version

test name

On known screen: retrieve “next best action” candidates

Optional: Vector DB (later). Phase 2 can use SQLite + embeddings table.

LLM Gate

LLM is called only if:

state unknown OR

retrieval confidence low OR

healing unresolved

Add budget controls:

max LLM calls per test

max tokens per call

caching of LLM responses by (goal + screen hash)

Record Mode (Manual Testing → Training Data)

Capture:

your actions (click/type)

before/after screenshots

UIMap

Auto-generate:

replayable script

candidate assertions

“golden” anchors for healing

Minimal annotation UI:

choose intended target element from UIMap when ambiguous

Stronger Healing (v1)

Incorporate:

neighbor graphs

text/caption similarity

optional visual crop embedding for target

Maintain “alias map” for elements that are renamed

Drift Alerts (v1)

Add semantic drift:

critical text changed

caption changed for key controls

Provide triage output:

severity score

probable cause (A/B, redesign, localization)

YOLO Training Path (optional but prepare now)

Export dataset from trajectories:

screenshots + bounding boxes + labels (button/input/icon)

Use OmniParser detections as weak labels initially

Add a small human labeling tool for corrections

Goal: train YOLO only for your custom widgets / frequent misses

Acceptance Criteria

For the same 5–10 flows:

LLM calls reduced by >= 70% vs Phase 1

Flake rate reduced (reruns needed) by >= 50%

“Record mode” produces a runnable test from a manual session

Drift alerts produce actionable diffs with low false positives

Engineering Tasks (Cursor worklist)

 Implement ScreenFingerprint + known-state registry

 Implement TemplateEngine + template definitions for key flows

 Implement RetrievalStore (SQLite) + action candidate selection

 Implement LLMGate + caching + budgets

 Implement RecordMode + action capture + script generation

 Upgrade HealingEngine to v1 (neighbors + alias map + embeddings optional)

 Upgrade DriftDetector to v1 (semantic + severity)

 Export dataset pipeline for YOLO training (COCO format preferred)

 Minimal labeling UI (optional) for correction of weak labels

Operational Considerations

Keep Perception as a replaceable module:

Today: OmniParser

Later: YOLO detector + OCR + lightweight captioner

Maintain versioning:

app build/version

parser version

template version

model versions

Implementation Notes (recommended defaults)

Language: TypeScript (runner) + Python (perception service) is fine

Transport: HTTP/JSON for Perception API

Storage: local filesystem (Phase 1), SQLite/Postgres (Phase 2)

Executor: Playwright for admin web tools

Security: internal-only, no third-party access, no screenshot exfiltration

“Cursor Coding Instructions” (how to proceed)

Implement shared/ schemas first (UIMap + Action)

Build Perception service wrapper returning UIMap

Build Runner CLI that:

captures screenshot

calls /parse

resolves target by ID

executes via Playwright

logs everything

Add HealingEngine + DriftDetector

Add LLM fallback with strict schema validation

Phase 2: add templates + retrieval + record mode + LLM gating

End.