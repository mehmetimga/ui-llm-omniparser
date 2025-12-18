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
  .option('--enhance-dom', 'Enable DOM/Accessibility tree enhancement for hybrid element matching')
  .action(runCommand);

program
  .command('generate')
  .description('Generate a test from natural language goal')
  .requiredOption('-g, --goal <goal>', 'Natural language goal (e.g., "Login and create a tournament")')
  .option('--base-url <url>', 'Base URL for the application', 'http://localhost:3000')
  .option('-o, --output <path>', 'Output path for generated test YAML')
  .option('--model <model>', 'Ollama model for planning', 'llama3.1:8b')
  .option('--ollama-url <url>', 'Ollama API URL', 'http://localhost:11434')
  .action(async (options) => {
    const { createAgentPlanner } = await import('../planner/agent.js');
    const chalk = (await import('chalk')).default;
    
    console.log(chalk.blue(`\n🤖 Generating test for: "${options.goal}"\n`));
    
    const planner = createAgentPlanner({
      model: options.model,
      ollamaUrl: options.ollamaUrl,
    });
    
    try {
      const yaml = await planner.goalToYAML(options.goal, options.baseUrl);
      
      if (options.output) {
        const fs = await import('fs/promises');
        await fs.writeFile(options.output, yaml);
        console.log(chalk.green(`✅ Test saved to: ${options.output}`));
      } else {
        console.log(chalk.yellow('Generated test:\n'));
        console.log(yaml);
      }
    } catch (error) {
      console.error(chalk.red('Failed to generate test:'), error);
      process.exit(1);
    }
  });

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

