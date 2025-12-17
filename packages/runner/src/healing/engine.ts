/**
 * Healing Engine v0 - Self-healing element resolution
 *
 * Matches expected elements to current UIMap using:
 * - Text/caption similarity
 * - Role match
 * - Approximate bbox proximity
 * - Neighbor anchor constraints
 */

import type {
  UIMap,
  UIElement,
  HealingEvent,
  HealingConfig,
} from '@ui-automation/shared';

export interface ElementMatcher {
  /** Expected element text */
  text?: string;
  /** Expected element caption */
  caption?: string;
  /** Expected element role */
  role?: string;
  /** Expected approximate bbox [x, y, w, h] */
  bbox?: [number, number, number, number];
  /** Expected neighbor element texts */
  neighborTexts?: string[];
}

export interface HealingCandidate {
  element: UIElement;
  score: number;
  reasons: string[];
}

export interface HealingResult {
  success: boolean;
  element?: UIElement;
  candidates: HealingCandidate[];
  event?: HealingEvent;
}

export const DEFAULT_HEALING_CONFIG: HealingConfig = {
  enabled: true,
  confidenceThreshold: 0.7,
  maxAttempts: 3,
  allowLlmFallback: true,
};

/**
 * Calculate text similarity using Levenshtein distance
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Calculate text similarity (0-1)
 */
function textSimilarity(a: string, b: string): number {
  if (!a && !b) return 1;
  if (!a || !b) return 0;

  const normalizedA = a.toLowerCase().trim();
  const normalizedB = b.toLowerCase().trim();

  if (normalizedA === normalizedB) return 1;

  const maxLen = Math.max(normalizedA.length, normalizedB.length);
  if (maxLen === 0) return 1;

  const distance = levenshteinDistance(normalizedA, normalizedB);
  return 1 - distance / maxLen;
}

/**
 * Calculate bbox proximity score (0-1)
 */
function bboxProximity(
  expected: [number, number, number, number],
  actual: [number, number, number, number],
  screenWidth: number,
  screenHeight: number
): number {
  const [ex, ey, ew, eh] = expected;
  const [ax, ay, aw, ah] = actual;

  // Center points
  const ecx = ex + ew / 2;
  const ecy = ey + eh / 2;
  const acx = ax + aw / 2;
  const acy = ay + ah / 2;

  // Distance between centers (normalized)
  const dx = Math.abs(ecx - acx) / screenWidth;
  const dy = Math.abs(ecy - acy) / screenHeight;
  const distance = Math.sqrt(dx * dx + dy * dy);

  // Convert distance to similarity (closer = higher score)
  return Math.max(0, 1 - distance * 2);
}

/**
 * Check if element has matching neighbor texts
 */
function hasMatchingNeighbors(
  element: UIElement,
  uiMap: UIMap,
  expectedNeighborTexts: string[]
): number {
  if (!expectedNeighborTexts || expectedNeighborTexts.length === 0) {
    return 0;
  }

  const allNeighborIds = [
    ...element.neighbors.left,
    ...element.neighbors.right,
    ...element.neighbors.above,
    ...element.neighbors.below,
  ];

  const neighborElements = allNeighborIds
    .map((id) => uiMap.elements.find((el) => el.id === id))
    .filter((el): el is UIElement => el !== undefined);

  let matchCount = 0;
  for (const expectedText of expectedNeighborTexts) {
    const hasMatch = neighborElements.some(
      (neighbor) => textSimilarity(neighbor.text, expectedText) > 0.7
    );
    if (hasMatch) matchCount++;
  }

  return matchCount / expectedNeighborTexts.length;
}

export class HealingEngine {
  private config: HealingConfig;

  constructor(config: Partial<HealingConfig> = {}) {
    this.config = { ...DEFAULT_HEALING_CONFIG, ...config };
  }

  /**
   * Find the best matching element for the given matcher
   */
  findElement(
    matcher: ElementMatcher,
    uiMap: UIMap,
    originalTarget?: string
  ): HealingResult {
    const candidates: HealingCandidate[] = [];

    for (const element of uiMap.elements) {
      const { score, reasons } = this.scoreElement(element, matcher, uiMap);

      if (score > 0) {
        candidates.push({ element, score, reasons });
      }
    }

    // Sort by score descending
    candidates.sort((a, b) => b.score - a.score);

    // Check if best match meets threshold
    const bestMatch = candidates[0];
    if (bestMatch && bestMatch.score >= this.config.confidenceThreshold) {
      const event: HealingEvent | undefined =
        originalTarget && originalTarget !== bestMatch.element.id
          ? {
              timestamp: new Date().toISOString(),
              originalTarget,
              healedTarget: bestMatch.element.id,
              method: this.getHealingMethod(bestMatch.reasons),
              confidence: bestMatch.score,
              candidates: candidates.slice(0, 5).map((c) => ({
                id: c.element.id,
                score: c.score,
                reason: c.reasons.join(', '),
              })),
            }
          : undefined;

      return {
        success: true,
        element: bestMatch.element,
        candidates,
        event,
      };
    }

    return {
      success: false,
      candidates,
    };
  }

  /**
   * Resolve an element by ID, with healing fallback
   */
  resolveElement(
    targetId: string,
    uiMap: UIMap,
    previousSignature?: ElementMatcher
  ): HealingResult {
    // First, try to find by exact ID
    const exactMatch = uiMap.elements.find((el) => el.id === targetId);
    if (exactMatch) {
      return {
        success: true,
        element: exactMatch,
        candidates: [{ element: exactMatch, score: 1.0, reasons: ['exact_id_match'] }],
      };
    }

    // If no exact match and we have a signature, try healing
    if (previousSignature) {
      return this.findElement(previousSignature, uiMap, targetId);
    }

    return {
      success: false,
      candidates: [],
    };
  }

  /**
   * Score an element against the matcher
   */
  private scoreElement(
    element: UIElement,
    matcher: ElementMatcher,
    uiMap: UIMap
  ): { score: number; reasons: string[] } {
    let totalScore = 0;
    let weightSum = 0;
    const reasons: string[] = [];

    // Text similarity (weight: 0.35)
    if (matcher.text) {
      const textScore = textSimilarity(element.text, matcher.text);
      totalScore += textScore * 0.35;
      weightSum += 0.35;
      if (textScore > 0.5) {
        reasons.push(`text_similarity: ${textScore.toFixed(2)}`);
      }
    }

    // Caption similarity (weight: 0.2)
    if (matcher.caption) {
      const captionScore = textSimilarity(element.caption, matcher.caption);
      totalScore += captionScore * 0.2;
      weightSum += 0.2;
      if (captionScore > 0.5) {
        reasons.push(`caption_similarity: ${captionScore.toFixed(2)}`);
      }
    }

    // Role match (weight: 0.2)
    if (matcher.role) {
      const roleScore = element.role === matcher.role ? 1 : 0;
      totalScore += roleScore * 0.2;
      weightSum += 0.2;
      if (roleScore > 0) {
        reasons.push('role_match');
      }
    }

    // Bbox proximity (weight: 0.15)
    if (matcher.bbox) {
      const bboxScore = bboxProximity(
        matcher.bbox,
        element.bbox,
        uiMap.screen.width,
        uiMap.screen.height
      );
      totalScore += bboxScore * 0.15;
      weightSum += 0.15;
      if (bboxScore > 0.5) {
        reasons.push(`bbox_proximity: ${bboxScore.toFixed(2)}`);
      }
    }

    // Neighbor anchors (weight: 0.1)
    if (matcher.neighborTexts && matcher.neighborTexts.length > 0) {
      const neighborScore = hasMatchingNeighbors(
        element,
        uiMap,
        matcher.neighborTexts
      );
      totalScore += neighborScore * 0.1;
      weightSum += 0.1;
      if (neighborScore > 0) {
        reasons.push(`neighbor_anchor: ${neighborScore.toFixed(2)}`);
      }
    }

    // Normalize score
    const normalizedScore = weightSum > 0 ? totalScore / weightSum : 0;

    return { score: normalizedScore, reasons };
  }

  /**
   * Determine the healing method based on reasons
   */
  private getHealingMethod(
    reasons: string[]
  ): HealingEvent['method'] {
    if (reasons.some((r) => r.startsWith('text_similarity'))) {
      return 'text_similarity';
    }
    if (reasons.includes('role_match')) {
      return 'role_match';
    }
    if (reasons.some((r) => r.startsWith('bbox_proximity'))) {
      return 'bbox_proximity';
    }
    if (reasons.some((r) => r.startsWith('neighbor_anchor'))) {
      return 'neighbor_anchor';
    }
    return 'text_similarity';
  }

  /**
   * Create an element signature from a UIElement for future healing
   */
  createSignature(element: UIElement, uiMap: UIMap): ElementMatcher {
    // Get neighbor texts for anchoring
    const allNeighborIds = [
      ...element.neighbors.left,
      ...element.neighbors.right,
      ...element.neighbors.above,
      ...element.neighbors.below,
    ];

    const neighborTexts = allNeighborIds
      .map((id) => uiMap.elements.find((el) => el.id === id))
      .filter((el): el is UIElement => el !== undefined && el.text.length > 0)
      .map((el) => el.text)
      .slice(0, 4); // Keep top 4 neighbors

    return {
      text: element.text,
      caption: element.caption,
      role: element.role,
      bbox: element.bbox,
      neighborTexts,
    };
  }
}

