import { z } from 'zod';

/**
 * Action types that can be performed on UI elements
 */
export const ActionTypeSchema = z.enum([
  'CLICK',
  'DOUBLE_CLICK',
  'RIGHT_CLICK',
  'TYPE',
  'CLEAR',
  'HOVER',
  'SELECT',
  'SCROLL',
  'WAIT',
  'ASSERT',
  'SCREENSHOT',
  'NAVIGATE',
  'PRESS_KEY',
]);

export type ActionType = z.infer<typeof ActionTypeSchema>;

/**
 * Assertion predicate kinds
 */
export const AssertPredicateKindSchema = z.enum([
  'TEXT_EXISTS',
  'TEXT_NOT_EXISTS',
  'ELEMENT_EXISTS',
  'ELEMENT_NOT_EXISTS',
  'ELEMENT_VISIBLE',
  'ELEMENT_HIDDEN',
  'TEXT_EQUALS',
  'URL_CONTAINS',
  'TITLE_CONTAINS',
  'ELEMENT_COUNT',
]);

export type AssertPredicateKind = z.infer<typeof AssertPredicateKindSchema>;

/**
 * Assertion predicate for ASSERT actions
 */
export const AssertPredicateSchema = z.object({
  kind: AssertPredicateKindSchema,
  value: z.union([z.string(), z.number()]).optional(),
  target: z.string().optional(),
  operator: z.enum(['eq', 'gt', 'lt', 'gte', 'lte']).optional(),
});

export type AssertPredicate = z.infer<typeof AssertPredicateSchema>;

/**
 * Scroll direction
 */
export const ScrollDirectionSchema = z.enum(['up', 'down', 'left', 'right']);

export type ScrollDirection = z.infer<typeof ScrollDirectionSchema>;

/**
 * A single test action
 */
export const TestActionSchema = z.object({
  /** Action type */
  type: ActionTypeSchema,

  /** Target element ID from UIMap (for element-targeting actions) */
  target: z.string().optional(),

  /** Text to type (for TYPE action) */
  text: z.string().optional(),

  /** Milliseconds to wait (for WAIT action) */
  ms: z.number().positive().optional(),

  /** Assertion predicate (for ASSERT action) */
  predicate: AssertPredicateSchema.optional(),

  /** URL to navigate to (for NAVIGATE action) */
  url: z.string().url().optional(),

  /** Key to press (for PRESS_KEY action) */
  key: z.string().optional(),

  /** Scroll direction (for SCROLL action) */
  direction: ScrollDirectionSchema.optional(),

  /** Scroll amount in pixels (for SCROLL action) */
  amount: z.number().optional(),

  /** Select option value (for SELECT action) */
  option: z.string().optional(),

  /** Description for logging */
  description: z.string().optional(),
});

export type TestAction = z.infer<typeof TestActionSchema>;

/**
 * Healing configuration for a step
 */
export const HealingConfigSchema = z.object({
  /** Enable healing for this step */
  enabled: z.boolean().default(true),

  /** Confidence threshold below which to trigger healing */
  confidenceThreshold: z.number().min(0).max(1).default(0.7),

  /** Maximum healing attempts */
  maxAttempts: z.number().positive().default(3),

  /** Fallback selectors if healing fails */
  fallbackSelectors: z.array(z.string()).optional(),

  /** Allow LLM fallback */
  allowLlmFallback: z.boolean().default(true),
});

export type HealingConfig = z.infer<typeof HealingConfigSchema>;

/**
 * A test step containing one or more actions
 */
export const TestStepSchema = z.object({
  /** Step name for logging */
  name: z.string(),

  /** Description of what this step does */
  description: z.string().optional(),

  /** Actions to perform in this step */
  actions: z.array(TestActionSchema).min(1),

  /** Healing configuration */
  healing: HealingConfigSchema.optional(),

  /** Timeout for the entire step in milliseconds */
  timeout: z.number().positive().default(30000),

  /** Continue on failure */
  continueOnFailure: z.boolean().default(false),

  /** Expected screen state after step (for validation) */
  expectedState: z
    .object({
      screenName: z.string().optional(),
      requiredElements: z.array(z.string()).optional(),
      forbiddenElements: z.array(z.string()).optional(),
    })
    .optional(),
});

export type TestStep = z.infer<typeof TestStepSchema>;

/**
 * Test suite metadata
 */
export const TestSuiteMetadataSchema = z.object({
  /** Suite name */
  name: z.string(),

  /** Suite description */
  description: z.string().optional(),

  /** Version */
  version: z.string().default('1.0.0'),

  /** Author */
  author: z.string().optional(),

  /** Tags for categorization */
  tags: z.array(z.string()).default([]),

  /** Target application */
  app: z.string().optional(),

  /** Environment requirements */
  environment: z
    .object({
      baseUrl: z.string().url().optional(),
      viewport: z
        .object({
          width: z.number().positive(),
          height: z.number().positive(),
        })
        .optional(),
      browser: z.enum(['chromium', 'firefox', 'webkit']).optional(),
    })
    .optional(),
});

export type TestSuiteMetadata = z.infer<typeof TestSuiteMetadataSchema>;

/**
 * Complete test suite definition
 */
export const TestSuiteSchema = z.object({
  /** Suite metadata */
  metadata: TestSuiteMetadataSchema,

  /** Setup steps to run before tests */
  setup: z.array(TestStepSchema).default([]),

  /** Test steps */
  steps: z.array(TestStepSchema).min(1),

  /** Teardown steps to run after tests */
  teardown: z.array(TestStepSchema).default([]),
});

export type TestSuite = z.infer<typeof TestSuiteSchema>;

/**
 * Action result status
 */
export const ActionResultStatusSchema = z.enum(['success', 'failure', 'skipped', 'healed']);

export type ActionResultStatus = z.infer<typeof ActionResultStatusSchema>;

/**
 * Result of executing an action
 */
export const ActionResultSchema = z.object({
  /** Action that was executed */
  action: TestActionSchema,

  /** Result status */
  status: ActionResultStatusSchema,

  /** Execution duration in milliseconds */
  duration: z.number(),

  /** Error message if failed */
  error: z.string().optional(),

  /** Healed target ID if healing was applied */
  healedTarget: z.string().optional(),

  /** Healing confidence if healed */
  healingConfidence: z.number().optional(),

  /** Timestamp */
  timestamp: z.string().datetime(),
});

export type ActionResult = z.infer<typeof ActionResultSchema>;

/**
 * Result of executing a step
 */
export const StepResultSchema = z.object({
  /** Step definition */
  step: TestStepSchema,

  /** Step result status */
  status: ActionResultStatusSchema,

  /** Individual action results */
  actionResults: z.array(ActionResultSchema),

  /** Total duration in milliseconds */
  duration: z.number(),

  /** Screenshot path before step */
  screenshotBefore: z.string().optional(),

  /** Screenshot path after step */
  screenshotAfter: z.string().optional(),

  /** UIMap before step */
  uiMapBefore: z.unknown().optional(),

  /** UIMap after step */
  uiMapAfter: z.unknown().optional(),
});

export type StepResult = z.infer<typeof StepResultSchema>;

// Helper functions

/**
 * Create a CLICK action
 */
export function click(target: string, description?: string): TestAction {
  return { type: 'CLICK', target, description };
}

/**
 * Create a TYPE action
 */
export function type(target: string, text: string, description?: string): TestAction {
  return { type: 'TYPE', target, text, description };
}

/**
 * Create a WAIT action
 */
export function wait(ms: number, description?: string): TestAction {
  return { type: 'WAIT', ms, description };
}

/**
 * Create an ASSERT action for text existence
 */
export function assertTextExists(value: string, description?: string): TestAction {
  return {
    type: 'ASSERT',
    predicate: { kind: 'TEXT_EXISTS', value },
    description,
  };
}

/**
 * Create an ASSERT action for element existence
 */
export function assertElementExists(target: string, description?: string): TestAction {
  return {
    type: 'ASSERT',
    target,
    predicate: { kind: 'ELEMENT_EXISTS', target },
    description,
  };
}

/**
 * Create a NAVIGATE action
 */
export function navigate(url: string, description?: string): TestAction {
  return { type: 'NAVIGATE', url, description };
}

/**
 * Create a HOVER action
 */
export function hover(target: string, description?: string): TestAction {
  return { type: 'HOVER', target, description };
}

/**
 * Create a PRESS_KEY action
 */
export function pressKey(key: string, description?: string): TestAction {
  return { type: 'PRESS_KEY', key, description };
}

