/**
 * Run command - Execute test suites
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { parse as parseYaml } from 'yaml';
import chalk from 'chalk';
import ora from 'ora';
import type { TestSuite, TestStep, UIMap, ActionResult } from '@ui-automation/shared';
import { TestSuiteSchema } from '@ui-automation/shared';
import { PlaywrightExecutor, ExecutorConfig } from '../../executor/playwright.js';
import { PerceptionClient } from '../../perception/client.js';
import { HealingEngine, ElementMatcher } from '../../healing/engine.js';
import { DriftDetector } from '../../drift/detector.js';
import { TrajectoryLogger } from '../../logger/trajectory.js';
import { LLMPlanner } from '../../planner/llm.js';

export interface RunOptions {
  test: string;
  headless?: boolean;
  browser?: 'chromium' | 'firefox' | 'webkit';
  baseUrl?: string;
  perceptionUrl?: string;
  outputDir?: string;
  verbose?: boolean;
  /** Enable DOM/Accessibility tree enhancement for hybrid element matching */
  enhanceDom?: boolean;
}

export async function runCommand(options: RunOptions): Promise<void> {
  const spinner = ora('Loading test suite...').start();

  try {
    // Load test suite
    const suite = await loadTestSuite(options.test);
    spinner.succeed(`Loaded test suite: ${suite.metadata.name}`);

    // Initialize components
    spinner.start('Initializing test runner...');

    const executorConfig: Partial<ExecutorConfig> = {
      headless: options.headless ?? true,
      browser: options.browser ?? 'chromium',
      baseUrl: options.baseUrl ?? suite.metadata.environment?.baseUrl,
      viewport: suite.metadata.environment?.viewport ?? { width: 1920, height: 1080 },
    };

    const executor = new PlaywrightExecutor(executorConfig);
    const perception = new PerceptionClient({
      baseUrl: options.perceptionUrl ?? 'http://localhost:8000',
    });
    const healingEngine = new HealingEngine();
    const driftDetector = new DriftDetector();
    const trajectoryLogger = new TrajectoryLogger({
      outputDir: options.outputDir ?? './trajectories',
    });
    const llmPlanner = new LLMPlanner({ enabled: false }); // Disabled by default

    await executor.initialize();
    spinner.succeed('Test runner initialized');

    // Check perception service
    spinner.start('Checking perception service...');
    try {
      const health = await perception.healthCheck();
      spinner.succeed(`Perception service ready (${health.parser})`);
    } catch (error) {
      spinner.warn('Perception service not available, using mock responses');
    }

    // Start trajectory logging
    const runId = await trajectoryLogger.startRun(suite, {
      baseUrl: executorConfig.baseUrl,
      browser: executorConfig.browser,
      viewport: executorConfig.viewport,
    });

    console.log(chalk.blue(`\n📋 Test Run: ${runId}\n`));

    // Run setup steps
    if (suite.setup.length > 0) {
      console.log(chalk.yellow('▶ Running setup steps...'));
      for (const step of suite.setup) {
        await executeStep(step, executor, perception, healingEngine, driftDetector, trajectoryLogger, -1, options.verbose, options.enhanceDom);
      }
    }

    // Run test steps
    console.log(chalk.yellow('\n▶ Running test steps...'));
    let passedSteps = 0;
    let failedSteps = 0;

    for (let i = 0; i < suite.steps.length; i++) {
      const step = suite.steps[i];
      const success = await executeStep(
        step,
        executor,
        perception,
        healingEngine,
        driftDetector,
        trajectoryLogger,
        i,
        options.verbose,
        options.enhanceDom
      );

      if (success) {
        passedSteps++;
      } else {
        failedSteps++;
        if (!step.continueOnFailure) {
          console.log(chalk.red('\n⛔ Stopping due to step failure'));
          break;
        }
      }
    }

    // Run teardown steps
    if (suite.teardown.length > 0) {
      console.log(chalk.yellow('\n▶ Running teardown steps...'));
      for (const step of suite.teardown) {
        await executeStep(step, executor, perception, healingEngine, driftDetector, trajectoryLogger, -1, options.verbose, options.enhanceDom);
      }
    }

    // End trajectory logging
    const trajectory = await trajectoryLogger.endRun();

    // Print summary
    console.log(chalk.blue('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
    console.log(chalk.bold('Test Summary'));
    console.log(chalk.blue('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
    console.log(`Total Steps: ${passedSteps + failedSteps}`);
    console.log(chalk.green(`Passed: ${passedSteps}`));
    console.log(chalk.red(`Failed: ${failedSteps}`));

    if (trajectory?.summary) {
      console.log(`Healed Steps: ${trajectory.summary.healedSteps}`);
      console.log(`Healing Events: ${trajectory.summary.totalHealingEvents}`);
      console.log(`Drift Alerts: ${trajectory.summary.totalDriftAlerts}`);
    }

    console.log(chalk.blue('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));

    // Cleanup
    await executor.cleanup();

    if (failedSteps > 0) {
      process.exit(1);
    }
  } catch (error) {
    spinner.fail(`Error: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
}

async function loadTestSuite(testPath: string): Promise<TestSuite> {
  const content = await fs.readFile(testPath, 'utf-8');

  let rawSuite: unknown;
  if (testPath.endsWith('.yaml') || testPath.endsWith('.yml')) {
    rawSuite = parseYaml(content);
  } else if (testPath.endsWith('.json')) {
    rawSuite = JSON.parse(content);
  } else {
    throw new Error('Test file must be .yaml, .yml, or .json');
  }

  // Validate against schema
  const result = TestSuiteSchema.safeParse(rawSuite);
  if (!result.success) {
    throw new Error(`Invalid test suite: ${result.error.message}`);
  }

  return result.data;
}

async function executeStep(
  step: TestStep,
  executor: PlaywrightExecutor,
  perception: PerceptionClient,
  healingEngine: HealingEngine,
  driftDetector: DriftDetector,
  trajectoryLogger: TrajectoryLogger,
  stepIndex: number,
  verbose?: boolean,
  enhanceDom?: boolean
): Promise<boolean> {
  const stepSpinner = ora(`${step.name}`).start();
  const startTime = Date.now();

  try {
    // Capture before state
    const beforeScreenshot = await executor.takeScreenshot();
    let beforeUIMap: UIMap;

    try {
      beforeUIMap = await perception.parse(beforeScreenshot);
    } catch {
      // Use empty UIMap if perception fails
      beforeUIMap = {
        screen: {
          width: 1920,
          height: 1080,
          timestamp: new Date().toISOString(),
          hash: '',
        },
        elements: [],
        parserVersion: 'mock',
      };
    }

    // Enhance UIMap with DOM selectors if enabled
    if (enhanceDom) {
      try {
        beforeUIMap = await executor.enhanceUIMapWithDOM(beforeUIMap);
        if (verbose) {
          const domElements = beforeUIMap.elements.filter(e => e.source === 'dom' || e.source === 'hybrid');
          console.log(chalk.cyan(`  [DOM] Enhanced ${domElements.length} elements with DOM selectors`));
        }
      } catch (e) {
        if (verbose) {
          console.log(chalk.yellow(`  [DOM] Failed to enhance UIMap: ${e}`));
        }
      }
    }

    // Store element signatures for healing
    const signatures = new Map<string, ElementMatcher>();
    for (const el of beforeUIMap.elements) {
      signatures.set(el.id, healingEngine.createSignature(el, beforeUIMap));
    }

    // Execute each action in the step
    let currentUIMap = beforeUIMap;
    
    for (const action of step.actions) {
      // For ASSERT actions, capture a fresh screenshot/UIMap to verify current state
      if (action.type === 'ASSERT') {
        const freshScreenshot = await executor.takeScreenshot();
        try {
          currentUIMap = await perception.parse(freshScreenshot);
        } catch {
          // Keep using previous UIMap if perception fails
        }
      }
      
      // Try to heal target if needed (skip for text-based selectors)
      if (action.target && !action.target.includes(':')) {
        // Only use healing for ID-based targets (E001, E002, etc.)
        const resolution = healingEngine.resolveElement(
          action.target,
          currentUIMap,
          signatures.get(action.target)
        );

        if (!resolution.success) {
          throw new Error(`Could not resolve element: ${action.target}`);
        }

        // Update target if healed
        if (resolution.element && resolution.element.id !== action.target) {
          if (verbose) {
            console.log(
              chalk.yellow(
                `\n  ↳ Healed: ${action.target} → ${resolution.element.id}`
              )
            );
          }
          action.target = resolution.element.id;
        }
      }
      // For text-based selectors (text:xxx, button:xxx), let executor handle it directly

      const result = await executor.executeAction(action, currentUIMap);

      if (result.status === 'failure') {
        throw new Error(result.error || 'Action failed');
      }
    }

    // Capture after state
    const afterScreenshot = await executor.takeScreenshot();
    let afterUIMap: UIMap;

    try {
      afterUIMap = await perception.parse(afterScreenshot);
    } catch {
      afterUIMap = beforeUIMap;
    }

    // Check for drift
    const driftResult = driftDetector.detectDrift(beforeUIMap, afterUIMap);
    if (driftResult.hasAlerts && verbose) {
      for (const alert of driftResult.alerts) {
        console.log(
          chalk.yellow(`\n  ⚠ Drift: ${alert.type} - ${alert.description}`)
        );
      }
    }

    // Log trajectory
    if (step.actions.length > 0) {
      const actionResult: ActionResult = {
        action: step.actions[0],
        status: 'success',
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      };

      await trajectoryLogger.logEntry(
        stepIndex,
        step.name,
        {
          screenshot: Buffer.from(beforeScreenshot, 'base64'),
          uiMap: beforeUIMap,
          url: executor.getCurrentUrl(),
        },
        step.actions[0],
        {
          screenshot: Buffer.from(afterScreenshot, 'base64'),
          uiMap: afterUIMap,
          url: executor.getCurrentUrl(),
        },
        actionResult,
        [],
        driftResult.alerts
      );
    }

    const duration = Date.now() - startTime;
    stepSpinner.succeed(`${step.name} ${chalk.gray(`(${duration}ms)`)}`);
    return true;
  } catch (error) {
    const duration = Date.now() - startTime;
    stepSpinner.fail(
      `${step.name} ${chalk.red(`- ${error instanceof Error ? error.message : error}`)} ${chalk.gray(`(${duration}ms)`)}`
    );
    return false;
  }
}

