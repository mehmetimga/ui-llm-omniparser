/**
 * LLM Fallback Planner - Constrained LLM for unknown screens / healing failures
 *
 * Only called when:
 * - Target element cannot be resolved confidently
 * - Screen is "unknown state"
 * - Healing failed
 */

import type { UIMap, UIElement, TestAction } from '@ui-automation/shared';

export interface LLMPlannerConfig {
  /** Enable LLM fallback */
  enabled: boolean;
  /** API endpoint for LLM */
  apiEndpoint?: string;
  /** API key */
  apiKey?: string;
  /** Model to use */
  model: string;
  /** Maximum tokens per request */
  maxTokens: number;
  /** Maximum LLM calls per test run */
  maxCallsPerRun: number;
  /** Temperature for generation */
  temperature: number;
}

export const DEFAULT_LLM_CONFIG: LLMPlannerConfig = {
  enabled: true,
  model: 'gpt-4o-mini',
  maxTokens: 500,
  maxCallsPerRun: 10,
  temperature: 0.1,
};

export interface PlannerRequest {
  /** Goal description */
  goal: string;
  /** Current UIMap (truncated) */
  uiMap: UIMap;
  /** Optional context about previous actions */
  context?: string;
}

export interface PlannerResponse {
  /** Planned actions */
  actions: TestAction[];
  /** Reasoning explanation */
  reasoning: string;
  /** Confidence in the plan */
  confidence: number;
}

export class LLMPlanner {
  private config: LLMPlannerConfig;
  private callCount: number = 0;
  private tokenUsage: number = 0;

  constructor(config: Partial<LLMPlannerConfig> = {}) {
    this.config = { ...DEFAULT_LLM_CONFIG, ...config };
  }

  /**
   * Request a plan from the LLM
   */
  async plan(request: PlannerRequest): Promise<PlannerResponse> {
    if (!this.config.enabled) {
      throw new Error('LLM planner is disabled');
    }

    if (this.callCount >= this.config.maxCallsPerRun) {
      throw new Error(
        `LLM call limit reached (${this.config.maxCallsPerRun} calls per run)`
      );
    }

    this.callCount++;

    // Build prompt
    const prompt = this.buildPrompt(request);

    // For now, return a mock response
    // In production, this would call the actual LLM API
    return this.mockPlan(request);
  }

  /**
   * Resolve an element when healing fails
   */
  async resolveElement(
    description: string,
    uiMap: UIMap
  ): Promise<{ elementId: string; confidence: number } | null> {
    if (!this.config.enabled) {
      return null;
    }

    const response = await this.plan({
      goal: `Find the element: ${description}`,
      uiMap: this.truncateUIMap(uiMap),
      context: 'Element resolution fallback',
    });

    if (response.actions.length > 0 && response.actions[0].target) {
      return {
        elementId: response.actions[0].target,
        confidence: response.confidence,
      };
    }

    return null;
  }

  /**
   * Build the prompt for the LLM
   */
  private buildPrompt(request: PlannerRequest): string {
    const interactables = request.uiMap.elements
      .filter((el) => el.interactable)
      .slice(0, 20); // Limit to top 20 interactables

    const elementsDescription = interactables
      .map(
        (el) =>
          `- ${el.id}: ${el.role} "${el.text}" (${el.caption}) at [${el.bbox.join(', ')}]`
      )
      .join('\n');

    return `You are a UI automation assistant. Given the current screen state and goal, determine the best action.

## Goal
${request.goal}

## Current Screen
URL: ${request.uiMap.screen.url || 'N/A'}
Dimensions: ${request.uiMap.screen.width}x${request.uiMap.screen.height}

## Available Interactive Elements
${elementsDescription}

## Context
${request.context || 'None'}

## Instructions
- Select ONE element ID from the list above
- Provide the action type (CLICK, TYPE, etc.)
- If TYPE, provide the text to type
- Respond in JSON format only

## Response Format
{
  "actions": [
    { "type": "CLICK", "target": "E001" }
  ],
  "reasoning": "Brief explanation",
  "confidence": 0.8
}`;
  }

  /**
   * Truncate UIMap to reduce token usage
   */
  private truncateUIMap(uiMap: UIMap): UIMap {
    // Keep only interactable elements and top 30
    const truncatedElements = uiMap.elements
      .filter((el) => el.interactable || el.text.length > 0)
      .slice(0, 30);

    return {
      ...uiMap,
      elements: truncatedElements,
    };
  }

  /**
   * Mock plan response for testing
   */
  private mockPlan(request: PlannerRequest): PlannerResponse {
    // Find the most likely element based on goal keywords
    const goalLower = request.goal.toLowerCase();
    const elements = request.uiMap.elements.filter((el) => el.interactable);

    let bestMatch: UIElement | null = null;
    let bestScore = 0;

    for (const el of elements) {
      let score = 0;
      const textLower = el.text.toLowerCase();
      const captionLower = el.caption.toLowerCase();

      // Check for keyword matches
      const keywords = goalLower.split(/\s+/);
      for (const keyword of keywords) {
        if (textLower.includes(keyword)) score += 2;
        if (captionLower.includes(keyword)) score += 1;
      }

      // Check for action hints
      if (goalLower.includes('click') && el.role === 'button') score += 1;
      if (goalLower.includes('type') && el.role === 'input') score += 1;
      if (goalLower.includes('search') && el.role === 'input') score += 1;
      if (goalLower.includes('login') && textLower.includes('login')) score += 2;
      if (goalLower.includes('submit') && textLower.includes('submit')) score += 2;

      if (score > bestScore) {
        bestScore = score;
        bestMatch = el;
      }
    }

    if (bestMatch) {
      const action: TestAction = {
        type: bestMatch.role === 'input' ? 'TYPE' : 'CLICK',
        target: bestMatch.id,
      };

      if (action.type === 'TYPE') {
        // Extract text from goal if possible
        const textMatch = request.goal.match(/["'](.+?)["']/);
        action.text = textMatch ? textMatch[1] : '';
      }

      return {
        actions: [action],
        reasoning: `Selected ${bestMatch.id} (${bestMatch.text || bestMatch.caption}) based on goal keywords`,
        confidence: Math.min(0.9, bestScore / 5),
      };
    }

    return {
      actions: [],
      reasoning: 'No suitable element found',
      confidence: 0,
    };
  }

  /**
   * Reset call counter (call at start of each test run)
   */
  resetCallCount(): void {
    this.callCount = 0;
    this.tokenUsage = 0;
  }

  /**
   * Get usage statistics
   */
  getUsageStats(): { calls: number; tokens: number } {
    return {
      calls: this.callCount,
      tokens: this.tokenUsage,
    };
  }
}

