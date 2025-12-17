#!/usr/bin/env node

/**
 * UI Automation Test Runner CLI
 */

import { Command } from 'commander';
import { runCommand } from './commands/run.js';

const program = new Command();

program
  .name('ui-runner')
  .description('AI-driven UI automation test runner')
  .version('0.1.0');

program
  .command('run')
  .description('Run a test suite')
  .requiredOption('-t, --test <path>', 'Path to test suite file (.yaml or .json)')
  .option('--headless', 'Run browser in headless mode', true)
  .option('--no-headless', 'Run browser with GUI')
  .option('-b, --browser <browser>', 'Browser to use (chromium, firefox, webkit)', 'chromium')
  .option('--base-url <url>', 'Base URL for the application')
  .option('--perception-url <url>', 'Perception service URL', 'http://localhost:8000')
  .option('-o, --output-dir <dir>', 'Output directory for trajectories', './trajectories')
  .option('-v, --verbose', 'Verbose output')
  .action(runCommand);

program
  .command('record')
  .description('Record a manual testing session (Phase 2)')
  .option('--base-url <url>', 'Base URL for the application')
  .option('-o, --output <path>', 'Output path for recorded test')
  .action(() => {
    console.log('Record mode will be available in Phase 2');
    process.exit(0);
  });

program
  .command('replay')
  .description('Replay a trajectory')
  .requiredOption('-t, --trajectory <path>', 'Path to trajectory file')
  .option('--headless', 'Run browser in headless mode', true)
  .action(() => {
    console.log('Replay mode will be available in Phase 2');
    process.exit(0);
  });

program
  .command('list-trajectories')
  .description('List recorded trajectories')
  .option('-d, --dir <dir>', 'Trajectories directory', './trajectories')
  .action(async (options) => {
    const { TrajectoryLogger } = await import('../logger/trajectory.js');
    const runs = await TrajectoryLogger.listRuns(options.dir);
    
    if (runs.length === 0) {
      console.log('No trajectories found');
    } else {
      console.log('Trajectories:');
      for (const run of runs) {
        console.log(`  - ${run}`);
      }
    }
  });

program.parse();

