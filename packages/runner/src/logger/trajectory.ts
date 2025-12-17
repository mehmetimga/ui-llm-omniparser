/**
 * Trajectory Logger - Logs test execution trajectories for replay and training
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import type {
  TrajectoryLog,
  TrajectoryEntry,
  TrajectoryConfig,
  TestRunMetadata,
  TestRunSummary,
  TestSuite,
  UIMap,
  TestAction,
  ActionResult,
  HealingEvent,
  DriftAlert,
} from '@ui-automation/shared';
import {
  generateRunId,
  generateEntryId,
  calculateSummary,
} from '@ui-automation/shared';

export const DEFAULT_TRAJECTORY_CONFIG: TrajectoryConfig = {
  enabled: true,
  outputDir: './trajectories',
  includeScreenshots: true,
  includeUiMaps: true,
  compressScreenshots: true,
  screenshotQuality: 80,
  maxFileSizeMb: 50,
};

export class TrajectoryLogger {
  private config: TrajectoryConfig;
  private runId: string;
  private entries: TrajectoryEntry[] = [];
  private metadata: TestRunMetadata | null = null;
  private suite: TestSuite | null = null;
  private screenshotDir: string = '';
  private startTime: Date | null = null;

  constructor(config: Partial<TrajectoryConfig> = {}) {
    this.config = { ...DEFAULT_TRAJECTORY_CONFIG, ...config };
    this.runId = generateRunId();
  }

  /**
   * Start a new test run
   */
  async startRun(
    suite: TestSuite,
    environment: TestRunMetadata['environment']
  ): Promise<string> {
    if (!this.config.enabled) {
      return this.runId;
    }

    this.suite = suite;
    this.startTime = new Date();
    this.entries = [];

    this.metadata = {
      runId: this.runId,
      suiteName: suite.metadata.name,
      startedAt: this.startTime.toISOString(),
      environment,
    };

    // Create output directories
    const runDir = path.join(this.config.outputDir, this.runId);
    this.screenshotDir = path.join(runDir, 'screenshots');

    await fs.mkdir(runDir, { recursive: true });
    await fs.mkdir(this.screenshotDir, { recursive: true });

    // Write initial metadata
    await this.writeMetadata();

    return this.runId;
  }

  /**
   * Log a single trajectory entry
   */
  async logEntry(
    stepIndex: number,
    stepName: string,
    stateBefore: {
      screenshot: Buffer;
      uiMap: UIMap;
      url?: string;
    },
    action: TestAction,
    stateAfter: {
      screenshot: Buffer;
      uiMap: UIMap;
      url?: string;
    },
    result: ActionResult,
    healingEvents: HealingEvent[] = [],
    driftAlerts: DriftAlert[] = []
  ): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    const entryId = generateEntryId(stepIndex);

    // Save screenshots
    let beforePath = '';
    let afterPath = '';

    if (this.config.includeScreenshots) {
      beforePath = await this.saveScreenshot(
        stateBefore.screenshot,
        `${entryId}_before.png`
      );
      afterPath = await this.saveScreenshot(
        stateAfter.screenshot,
        `${entryId}_after.png`
      );
    }

    const entry: TrajectoryEntry = {
      id: entryId,
      stepIndex,
      stepName,
      timestamp: new Date().toISOString(),
      stateBefore: {
        screenshotPath: beforePath,
        uiMap: this.config.includeUiMaps ? stateBefore.uiMap : ({} as UIMap),
        url: stateBefore.url,
      },
      action,
      stateAfter: {
        screenshotPath: afterPath,
        uiMap: this.config.includeUiMaps ? stateAfter.uiMap : ({} as UIMap),
        url: stateAfter.url,
      },
      result,
      healingEvents,
      driftAlerts,
      duration: result.duration,
    };

    this.entries.push(entry);

    // Write incremental entry
    await this.writeEntry(entry);
  }

  /**
   * End the test run and write final trajectory
   */
  async endRun(): Promise<TrajectoryLog | null> {
    if (!this.config.enabled || !this.metadata || !this.suite) {
      return null;
    }

    this.metadata.endedAt = new Date().toISOString();

    const summary = calculateSummary(this.entries);

    const trajectoryLog: TrajectoryLog = {
      version: '1.0.0',
      metadata: this.metadata,
      suite: this.suite,
      entries: this.entries,
      summary,
    };

    // Write final trajectory file
    await this.writeTrajectoryLog(trajectoryLog);

    return trajectoryLog;
  }

  /**
   * Save a screenshot to disk
   */
  private async saveScreenshot(
    screenshot: Buffer,
    filename: string
  ): Promise<string> {
    const filepath = path.join(this.screenshotDir, filename);

    // For now, just save the PNG directly
    // In production, you might want to compress with sharp
    await fs.writeFile(filepath, screenshot);

    return filepath;
  }

  /**
   * Write metadata file
   */
  private async writeMetadata(): Promise<void> {
    const metadataPath = path.join(
      this.config.outputDir,
      this.runId,
      'metadata.json'
    );
    await fs.writeFile(metadataPath, JSON.stringify(this.metadata, null, 2));
  }

  /**
   * Write a single entry file
   */
  private async writeEntry(entry: TrajectoryEntry): Promise<void> {
    const entryPath = path.join(
      this.config.outputDir,
      this.runId,
      'entries',
      `${entry.id}.json`
    );

    await fs.mkdir(path.dirname(entryPath), { recursive: true });

    // Write entry without full UIMaps to save space
    const compactEntry = {
      ...entry,
      stateBefore: {
        ...entry.stateBefore,
        uiMap: {
          screen: entry.stateBefore.uiMap.screen,
          elementCount: entry.stateBefore.uiMap.elements?.length ?? 0,
        },
      },
      stateAfter: {
        ...entry.stateAfter,
        uiMap: {
          screen: entry.stateAfter.uiMap.screen,
          elementCount: entry.stateAfter.uiMap.elements?.length ?? 0,
        },
      },
    };

    await fs.writeFile(entryPath, JSON.stringify(compactEntry, null, 2));
  }

  /**
   * Write the complete trajectory log
   */
  private async writeTrajectoryLog(log: TrajectoryLog): Promise<void> {
    const logPath = path.join(
      this.config.outputDir,
      this.runId,
      'trajectory.json'
    );

    await fs.writeFile(logPath, JSON.stringify(log, null, 2));
  }

  /**
   * Get the current run ID
   */
  getRunId(): string {
    return this.runId;
  }

  /**
   * Get trajectory entries
   */
  getEntries(): TrajectoryEntry[] {
    return this.entries;
  }

  /**
   * Load a trajectory log from disk
   */
  static async loadTrajectory(trajectoryPath: string): Promise<TrajectoryLog> {
    const content = await fs.readFile(trajectoryPath, 'utf-8');
    return JSON.parse(content) as TrajectoryLog;
  }

  /**
   * List all trajectory runs
   */
  static async listRuns(outputDir: string): Promise<string[]> {
    try {
      const entries = await fs.readdir(outputDir, { withFileTypes: true });
      return entries
        .filter((e) => e.isDirectory() && e.name.startsWith('run_'))
        .map((e) => e.name);
    } catch {
      return [];
    }
  }
}

