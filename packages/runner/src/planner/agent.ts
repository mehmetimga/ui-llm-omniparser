/**
 * LLM Agent Planner - Natural language test generation
 * 
 * Allows users to specify tests in natural language:
 * "Login to the admin panel and create a new tournament"
 * 
 * Uses local LLM (via Ollama) to plan and execute actions.
 */

import type { TestAction, UIMap, UIElement } from '@ui-automation/shared';
import chalk from 'chalk';

export interface AgentConfig {
  /** Ollama API URL */
  ollamaUrl: string;
  /** Model to use for planning */
  model: string;
  /** Maximum steps before giving up */
  maxSteps: number;
  /** Enable verbose logging */
  verbose: boolean;
}

export const DEFAULT_AGENT_CONFIG: AgentConfig = {
  ollamaUrl: 'http://localhost:11434',
  model: 'llama3.1:8b',
  maxSteps: 20,
  verbose: false,
};

interface PlannerResponse {
  thought: string;
  action: TestAction | null;
  isComplete: boolean;
  error?: string;
}

interface AgentState {
  goal: string;
  currentUrl: string;
  stepCount: number;
  history: Array<{
    action: TestAction;
    result: 'success' | 'failure';
    uiSummary: string;
  }>;
}

export class LLMAgentPlanner {
  private config: AgentConfig;

  constructor(config: Partial<AgentConfig> = {}) {
    this.config = { ...DEFAULT_AGENT_CONFIG, ...config };
  }

  /**
   * Generate the next action to take based on current state
   */
  async planNextAction(
    goal: string,
    uiMap: UIMap,
    history: AgentState['history'] = [],
    currentUrl: string = ''
  ): Promise<PlannerResponse> {
    const systemPrompt = this.buildSystemPrompt();
    const userPrompt = this.buildUserPrompt(goal, uiMap, history, currentUrl);

    try {
      const response = await this.callOllama(systemPrompt, userPrompt);
      return this.parseResponse(response);
    } catch (error) {
      return {
        thought: 'Error calling LLM',
        action: null,
        isComplete: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Generate a complete test plan from a natural language goal
   */
  async generateTestPlan(
    goal: string,
    uiMap: UIMap,
    currentUrl: string = ''
  ): Promise<TestAction[]> {
    const systemPrompt = `You are a UI test planner. Given a goal and UI elements, generate a sequence of test actions.

Available action types:
- NAVIGATE: Navigate to a URL
- CLICK: Click an element (use text: prefix for text-based targeting)
- TYPE: Type text into an input (requires target and text)
- WAIT: Wait for milliseconds
- ASSERT: Assert a condition (TEXT_EXISTS, URL_CONTAINS, etc.)
- PRESS_KEY: Press a keyboard key (Tab, Enter, Escape)

Output format - JSON array of actions:
[
  {"type": "NAVIGATE", "url": "http://localhost:3000"},
  {"type": "CLICK", "target": "text:Sign In"},
  {"type": "TYPE", "target": "selector:input[type=email]", "text": "admin@example.com"},
  {"type": "WAIT", "ms": 1000},
  {"type": "ASSERT", "predicate": {"kind": "TEXT_EXISTS", "value": "Dashboard"}}
]

Return ONLY the JSON array, no explanations.`;

    const userPrompt = `Goal: ${goal}

Current URL: ${currentUrl || 'not loaded'}

Available UI elements:
${this.formatUIElements(uiMap)}

Generate the test actions to achieve the goal.`;

    try {
      const response = await this.callOllama(systemPrompt, userPrompt);
      return this.parseActionsResponse(response);
    } catch (error) {
      console.error(chalk.red('Failed to generate test plan:'), error);
      return [];
    }
  }

  /**
   * Convert natural language goal to YAML test format
   */
  async goalToYAML(
    goal: string,
    baseUrl: string = 'http://localhost:3000'
  ): Promise<string> {
    const systemPrompt = `You are a UI test generator. Convert natural language goals into YAML test files.

Output format:
\`\`\`yaml
metadata:
  name: Test Name
  description: Description
  environment:
    baseUrl: ${baseUrl}
    viewport:
      width: 1920
      height: 1080

steps:
  - name: Step name
    actions:
      - type: ACTION_TYPE
        # action parameters
\`\`\`

Use these action types:
- NAVIGATE (url)
- CLICK (target: text:xxx, selector:xxx, or locator:xxx)
- TYPE (target, text)
- WAIT (ms)
- ASSERT (predicate: {kind, value})
- PRESS_KEY (key)

Return ONLY the YAML, no explanations.`;

    const userPrompt = `Goal: ${goal}

Base URL: ${baseUrl}

Generate a complete YAML test file.`;

    try {
      const response = await this.callOllama(systemPrompt, userPrompt);
      return this.extractYAML(response);
    } catch (error) {
      console.error(chalk.red('Failed to generate YAML:'), error);
      return '';
    }
  }

  private buildSystemPrompt(): string {
    return `You are an AI UI testing agent. Your job is to interact with web pages to achieve user goals.

For each turn, you will:
1. Analyze the current UI state
2. Decide what action to take
3. Determine if the goal is complete

Respond in JSON format:
{
  "thought": "Your reasoning about what to do next",
  "action": {
    "type": "CLICK|TYPE|NAVIGATE|WAIT|ASSERT|PRESS_KEY",
    "target": "element target (for CLICK/TYPE)",
    "text": "text to type (for TYPE)",
    "url": "url (for NAVIGATE)",
    "ms": 1000,
    "key": "Enter|Tab|Escape",
    "predicate": {"kind": "TEXT_EXISTS", "value": "text"}
  },
  "isComplete": false
}

If the goal is achieved, set isComplete to true and action to null.

Target formats:
- "text:Button Text" - Click element by visible text
- "selector:input[type=email]" - CSS selector
- "locator:Sign In" - Playwright getByRole button
- "label:Email" - Playwright getByLabel`;
  }

  private buildUserPrompt(
    goal: string,
    uiMap: UIMap,
    history: AgentState['history'],
    currentUrl: string
  ): string {
    const historyStr = history.length > 0
      ? `Previous actions:\n${history.map((h, i) => 
          `${i + 1}. ${h.action.type} → ${h.result}`
        ).join('\n')}\n\n`
      : '';

    return `Goal: ${goal}

Current URL: ${currentUrl || uiMap.screen.url || 'unknown'}
Current page title: ${uiMap.screen.title || 'unknown'}

${historyStr}Visible UI elements:
${this.formatUIElements(uiMap)}

What should be the next action?`;
  }

  private formatUIElements(uiMap: UIMap): string {
    if (!uiMap.elements || uiMap.elements.length === 0) {
      return '(No elements detected)';
    }

    return uiMap.elements
      .filter(el => el.interactable || el.text)
      .slice(0, 30) // Limit to 30 elements
      .map(el => {
        const parts = [`[${el.id}]`, el.role];
        if (el.text) parts.push(`"${el.text.slice(0, 50)}"`);
        if (el.domSelector?.css) parts.push(`(${el.domSelector.css})`);
        return parts.join(' ');
      })
      .join('\n');
  }

  private async callOllama(systemPrompt: string, userPrompt: string): Promise<string> {
    const response = await fetch(`${this.config.ollamaUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.config.model,
        prompt: `${systemPrompt}\n\n${userPrompt}`,
        stream: false,
        options: {
          temperature: 0.1,
          num_predict: 1000,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama request failed: ${response.status}`);
    }

    const data = await response.json() as { response?: string };
    return data.response || '';
  }

  private parseResponse(response: string): PlannerResponse {
    try {
      // Try to extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          thought: parsed.thought || '',
          action: parsed.action || null,
          isComplete: parsed.isComplete || false,
        };
      }
    } catch (e) {
      // Fall through to error case
    }

    return {
      thought: 'Failed to parse LLM response',
      action: null,
      isComplete: false,
      error: 'Invalid response format',
    };
  }

  private parseActionsResponse(response: string): TestAction[] {
    try {
      // Try to extract JSON array from response
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.error('Failed to parse actions:', e);
    }
    return [];
  }

  private extractYAML(response: string): string {
    // Extract YAML from markdown code block
    const yamlMatch = response.match(/```ya?ml\n([\s\S]*?)```/);
    if (yamlMatch) {
      return yamlMatch[1].trim();
    }
    
    // If no code block, try to find YAML-like content
    if (response.includes('metadata:') && response.includes('steps:')) {
      return response.trim();
    }
    
    return response;
  }
}

export function createAgentPlanner(config?: Partial<AgentConfig>): LLMAgentPlanner {
  return new LLMAgentPlanner(config);
}

