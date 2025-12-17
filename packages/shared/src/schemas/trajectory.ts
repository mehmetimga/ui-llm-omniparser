import { z } from 'zod';
import { UIMapSchema } from './ui-map.js';
import { TestActionSchema, ActionResultSchema, StepResultSchema, TestSuiteSchema } from './action.js';

/**
 * Healing event that occurred during test execution
 */
export const HealingEventSchema = z.object({
  /** Timestamp of healing event */
  timestamp: z.string().datetime(),

  /** Original target element ID */
  originalTarget: z.string(),

  /** Healed target element ID */
  healedTarget: z.string(),

  /** Healing method used */
  method: z.enum(['text_similarity', 'role_match', 'bbox_proximity', 'neighbor_anchor', 'llm_fallback']),

  /** Confidence of the healing */
  confidence: z.number().min(0).max(1),

  /** Candidate elements considered */
  candidates: z.array(
    z.object({
      id: z.string(),
      score: z.number(),
      reason: z.string(),
    })
  ),

  /** Additional details */
  details: z.record(z.unknown()).optional(),
});

export type HealingEvent = z.infer<typeof HealingEventSchema>;

/**
 * Drift alert generated during test execution
 */
export const DriftAlertSchema = z.object({
  /** Alert timestamp */
  timestamp: z.string().datetime(),

  /** Severity level */
  severity: z.enum(['low', 'medium', 'high', 'critical']),

  /** Type of drift detected */
  type: z.enum([
    'element_count_change',
    'layout_shift',
    'text_change',
    'missing_anchor',
    'new_element',
    'removed_element',
    'role_change',
  ]),

  /** Description of the drift */
  description: z.string(),

  /** Affected element IDs */
  affectedElements: z.array(z.string()),

  /** Expected value */
  expected: z.unknown().optional(),

  /** Actual value */
  actual: z.unknown().optional(),

  /** Screenshot path showing the drift */
  screenshotPath: z.string().optional(),
});

export type DriftAlert = z.infer<typeof DriftAlertSchema>;

/**
 * A single trajectory entry (one step execution)
 */
export const TrajectoryEntrySchema = z.object({
  /** Entry ID */
  id: z.string(),

  /** Step index in the test */
  stepIndex: z.number(),

  /** Step name */
  stepName: z.string(),

  /** Timestamp */
  timestamp: z.string().datetime(),

  /** State before action */
  stateBefore: z.object({
    /** Screenshot path */
    screenshotPath: z.string(),

    /** UIMap */
    uiMap: UIMapSchema,

    /** Current URL (for web) */
    url: z.string().optional(),
  }),

  /** Action performed */
  action: TestActionSchema,

  /** State after action */
  stateAfter: z.object({
    /** Screenshot path */
    screenshotPath: z.string(),

    /** UIMap */
    uiMap: UIMapSchema,

    /** Current URL (for web) */
    url: z.string().optional(),
  }),

  /** Action result */
  result: ActionResultSchema,

  /** Healing events if any occurred */
  healingEvents: z.array(HealingEventSchema).default([]),

  /** Drift alerts if any detected */
  driftAlerts: z.array(DriftAlertSchema).default([]),

  /** Execution duration in ms */
  duration: z.number(),
});

export type TrajectoryEntry = z.infer<typeof TrajectoryEntrySchema>;

/**
 * Test run metadata
 */
export const TestRunMetadataSchema = z.object({
  /** Unique run ID */
  runId: z.string(),

  /** Test suite name */
  suiteName: z.string(),

  /** Start timestamp */
  startedAt: z.string().datetime(),

  /** End timestamp */
  endedAt: z.string().datetime().optional(),

  /** Environment info */
  environment: z.object({
    /** Base URL */
    baseUrl: z.string().optional(),

    /** Browser */
    browser: z.string().optional(),

    /** Viewport */
    viewport: z
      .object({
        width: z.number(),
        height: z.number(),
      })
      .optional(),

    /** OS */
    os: z.string().optional(),

    /** App version */
    appVersion: z.string().optional(),

    /** Parser version */
    parserVersion: z.string().optional(),
  }),

  /** Git info if available */
  git: z
    .object({
      branch: z.string().optional(),
      commit: z.string().optional(),
    })
    .optional(),
});

export type TestRunMetadata = z.infer<typeof TestRunMetadataSchema>;

/**
 * Test run summary
 */
export const TestRunSummarySchema = z.object({
  /** Total steps */
  totalSteps: z.number(),

  /** Passed steps */
  passedSteps: z.number(),

  /** Failed steps */
  failedSteps: z.number(),

  /** Skipped steps */
  skippedSteps: z.number(),

  /** Healed steps */
  healedSteps: z.number(),

  /** Total duration in ms */
  totalDuration: z.number(),

  /** Total healing events */
  totalHealingEvents: z.number(),

  /** Total drift alerts */
  totalDriftAlerts: z.number(),

  /** LLM calls made */
  llmCalls: z.number(),

  /** LLM tokens used */
  llmTokensUsed: z.number().optional(),
});

export type TestRunSummary = z.infer<typeof TestRunSummarySchema>;

/**
 * Complete trajectory log for a test run
 */
export const TrajectoryLogSchema = z.object({
  /** Log version */
  version: z.string().default('1.0.0'),

  /** Run metadata */
  metadata: TestRunMetadataSchema,

  /** Test suite definition */
  suite: TestSuiteSchema,

  /** Trajectory entries */
  entries: z.array(TrajectoryEntrySchema),

  /** Run summary */
  summary: TestRunSummarySchema.optional(),
});

export type TrajectoryLog = z.infer<typeof TrajectoryLogSchema>;

/**
 * Configuration for trajectory logging
 */
export const TrajectoryConfigSchema = z.object({
  /** Enable trajectory logging */
  enabled: z.boolean().default(true),

  /** Output directory for trajectories */
  outputDir: z.string().default('./trajectories'),

  /** Include screenshots */
  includeScreenshots: z.boolean().default(true),

  /** Include UIMaps */
  includeUiMaps: z.boolean().default(true),

  /** Compress screenshots */
  compressScreenshots: z.boolean().default(true),

  /** Screenshot quality (1-100) */
  screenshotQuality: z.number().min(1).max(100).default(80),

  /** Maximum trajectory file size in MB */
  maxFileSizeMb: z.number().positive().default(50),

  /** Retention policy */
  retention: z
    .object({
      /** Keep trajectories for N days */
      days: z.number().positive().default(30),

      /** Maximum number of trajectories to keep */
      maxCount: z.number().positive().default(1000),
    })
    .optional(),
});

export type TrajectoryConfig = z.infer<typeof TrajectoryConfigSchema>;

// Helper functions

/**
 * Generate a unique run ID
 */
export function generateRunId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `run_${timestamp}_${random}`;
}

/**
 * Generate a trajectory entry ID
 */
export function generateEntryId(stepIndex: number): string {
  const timestamp = Date.now().toString(36);
  return `entry_${stepIndex}_${timestamp}`;
}

/**
 * Calculate test run summary from entries
 */
export function calculateSummary(entries: TrajectoryEntry[]): TestRunSummary {
  let passedSteps = 0;
  let failedSteps = 0;
  let skippedSteps = 0;
  let healedSteps = 0;
  let totalDuration = 0;
  let totalHealingEvents = 0;
  let totalDriftAlerts = 0;

  for (const entry of entries) {
    totalDuration += entry.duration;
    totalHealingEvents += entry.healingEvents.length;
    totalDriftAlerts += entry.driftAlerts.length;

    switch (entry.result.status) {
      case 'success':
        passedSteps++;
        break;
      case 'failure':
        failedSteps++;
        break;
      case 'skipped':
        skippedSteps++;
        break;
      case 'healed':
        healedSteps++;
        passedSteps++;
        break;
    }
  }

  return {
    totalSteps: entries.length,
    passedSteps,
    failedSteps,
    skippedSteps,
    healedSteps,
    totalDuration,
    totalHealingEvents,
    totalDriftAlerts,
    llmCalls: 0, // Updated by planner
    llmTokensUsed: 0,
  };
}

/**
 * Format duration for display
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  if (ms < 60000) {
    return `${(ms / 1000).toFixed(2)}s`;
  }
  const minutes = Math.floor(ms / 60000);
  const seconds = ((ms % 60000) / 1000).toFixed(0);
  return `${minutes}m ${seconds}s`;
}

