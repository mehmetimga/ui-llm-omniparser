/**
 * UI Automation Runner - Main exports
 */

// Executor
export { PlaywrightExecutor, DEFAULT_EXECUTOR_CONFIG } from './executor/playwright.js';
export type { ExecutorConfig } from './executor/playwright.js';

// Perception Client
export { PerceptionClient, createPerceptionClient } from './perception/client.js';
export type { PerceptionClientConfig } from './perception/client.js';

// Healing Engine
export {
  HealingEngine,
  DEFAULT_HEALING_CONFIG,
} from './healing/engine.js';
export type {
  ElementMatcher,
  HealingCandidate,
  HealingResult,
} from './healing/engine.js';

// Drift Detector
export {
  DriftDetector,
  DEFAULT_DRIFT_CONFIG,
} from './drift/detector.js';
export type {
  DriftDetectorConfig,
  DriftDetectionResult,
} from './drift/detector.js';

// Trajectory Logger
export {
  TrajectoryLogger,
  DEFAULT_TRAJECTORY_CONFIG,
} from './logger/trajectory.js';

// LLM Planner
export {
  LLMPlanner,
  DEFAULT_LLM_CONFIG,
} from './planner/llm.js';
export type {
  LLMPlannerConfig,
  PlannerRequest,
  PlannerResponse,
} from './planner/llm.js';
