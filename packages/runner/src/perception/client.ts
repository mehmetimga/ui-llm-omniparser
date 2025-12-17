/**
 * Perception Service API client
 */

import type { UIMap, ParseRequest } from '@ui-automation/shared';

export interface PerceptionClientConfig {
  baseUrl: string;
  timeout?: number;
}

export class PerceptionClient {
  private baseUrl: string;
  private timeout: number;

  constructor(config: PerceptionClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.timeout = config.timeout ?? 30000;
  }

  /**
   * Check if perception service is healthy
   */
  async healthCheck(): Promise<{ status: string; version: string; parser: string }> {
    const response = await fetch(`${this.baseUrl}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(this.timeout),
    });

    if (!response.ok) {
      throw new Error(`Health check failed: ${response.status} ${response.statusText}`);
    }

    return response.json() as Promise<{ status: string; version: string; parser: string }>;
  }

  /**
   * Parse a screenshot and get UIMap
   */
  async parse(
    imageBase64: string,
    metadata?: { testId?: string; env?: string; stepName?: string }
  ): Promise<UIMap> {
    const request: ParseRequest = {
      image_base64: imageBase64,
      metadata: metadata
        ? {
            test_id: metadata.testId,
            env: metadata.env,
            step_name: metadata.stepName,
          }
        : undefined,
    };

    const response = await fetch(`${this.baseUrl}/parse`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(this.timeout),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Parse failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    return response.json() as Promise<UIMap>;
  }
}

/**
 * Create a perception client with default settings
 */
export function createPerceptionClient(
  baseUrl: string = 'http://localhost:8000'
): PerceptionClient {
  return new PerceptionClient({ baseUrl });
}

