/**
 * Drift Detector v0 - Detects unexpected UI changes
 *
 * Alerts on:
 * - Element count change > threshold
 * - Key anchor text changed
 * - Layout shift for anchors > threshold
 */

import type { UIMap, UIElement, DriftAlert } from '@ui-automation/shared';

export interface DriftDetectorConfig {
  /** Enable drift detection */
  enabled: boolean;
  /** Threshold for element count change (percentage) */
  elementCountThreshold: number;
  /** Threshold for layout shift (pixels) */
  layoutShiftThreshold: number;
  /** Key anchor element IDs to monitor */
  anchorElements: string[];
  /** Key text patterns to monitor */
  anchorTexts: string[];
}

export const DEFAULT_DRIFT_CONFIG: DriftDetectorConfig = {
  enabled: true,
  elementCountThreshold: 0.3, // 30% change
  layoutShiftThreshold: 50, // 50 pixels
  anchorElements: [],
  anchorTexts: [],
};

export interface DriftDetectionResult {
  hasAlerts: boolean;
  alerts: DriftAlert[];
}

export class DriftDetector {
  private config: DriftDetectorConfig;

  constructor(config: Partial<DriftDetectorConfig> = {}) {
    this.config = { ...DEFAULT_DRIFT_CONFIG, ...config };
  }

  /**
   * Compare two UIMaps and detect drift
   */
  detectDrift(
    expected: UIMap,
    actual: UIMap,
    stepName?: string
  ): DriftDetectionResult {
    if (!this.config.enabled) {
      return { hasAlerts: false, alerts: [] };
    }

    const alerts: DriftAlert[] = [];

    // Check element count change
    const countAlert = this.checkElementCountChange(expected, actual);
    if (countAlert) alerts.push(countAlert);

    // Check for missing anchor elements
    const missingAnchors = this.checkMissingAnchors(expected, actual);
    alerts.push(...missingAnchors);

    // Check for layout shifts
    const layoutShifts = this.checkLayoutShifts(expected, actual);
    alerts.push(...layoutShifts);

    // Check anchor text changes
    const textChanges = this.checkTextChanges(expected, actual);
    alerts.push(...textChanges);

    // Check for new elements
    const newElements = this.checkNewElements(expected, actual);
    if (newElements) alerts.push(newElements);

    // Check for removed elements
    const removedElements = this.checkRemovedElements(expected, actual);
    if (removedElements) alerts.push(removedElements);

    return {
      hasAlerts: alerts.length > 0,
      alerts,
    };
  }

  /**
   * Check if element count changed significantly
   */
  private checkElementCountChange(
    expected: UIMap,
    actual: UIMap
  ): DriftAlert | null {
    const expectedCount = expected.elements.length;
    const actualCount = actual.elements.length;

    if (expectedCount === 0) return null;

    const changeRatio = Math.abs(actualCount - expectedCount) / expectedCount;

    if (changeRatio > this.config.elementCountThreshold) {
      return {
        timestamp: new Date().toISOString(),
        severity: changeRatio > 0.5 ? 'high' : 'medium',
        type: 'element_count_change',
        description: `Element count changed from ${expectedCount} to ${actualCount} (${(changeRatio * 100).toFixed(1)}% change)`,
        affectedElements: [],
        expected: expectedCount,
        actual: actualCount,
      };
    }

    return null;
  }

  /**
   * Check for missing anchor elements
   */
  private checkMissingAnchors(
    expected: UIMap,
    actual: UIMap
  ): DriftAlert[] {
    const alerts: DriftAlert[] = [];

    // Check configured anchor elements
    for (const anchorId of this.config.anchorElements) {
      const expectedEl = expected.elements.find((el) => el.id === anchorId);
      const actualEl = actual.elements.find((el) => el.id === anchorId);

      if (expectedEl && !actualEl) {
        alerts.push({
          timestamp: new Date().toISOString(),
          severity: 'high',
          type: 'missing_anchor',
          description: `Anchor element ${anchorId} (${expectedEl.text || expectedEl.role}) is missing`,
          affectedElements: [anchorId],
          expected: expectedEl,
          actual: null,
        });
      }
    }

    // Check anchor texts
    for (const anchorText of this.config.anchorTexts) {
      const expectedEl = expected.elements.find(
        (el) => el.text.toLowerCase().includes(anchorText.toLowerCase())
      );
      const actualEl = actual.elements.find(
        (el) => el.text.toLowerCase().includes(anchorText.toLowerCase())
      );

      if (expectedEl && !actualEl) {
        alerts.push({
          timestamp: new Date().toISOString(),
          severity: 'high',
          type: 'missing_anchor',
          description: `Anchor text "${anchorText}" is missing`,
          affectedElements: [expectedEl.id],
          expected: anchorText,
          actual: null,
        });
      }
    }

    return alerts;
  }

  /**
   * Check for significant layout shifts
   */
  private checkLayoutShifts(
    expected: UIMap,
    actual: UIMap
  ): DriftAlert[] {
    const alerts: DriftAlert[] = [];

    // Check anchor elements for shifts
    for (const anchorId of this.config.anchorElements) {
      const expectedEl = expected.elements.find((el) => el.id === anchorId);
      const actualEl = actual.elements.find((el) => el.id === anchorId);

      if (expectedEl && actualEl) {
        const [ex, ey] = expectedEl.bbox;
        const [ax, ay] = actualEl.bbox;
        const shift = Math.sqrt(Math.pow(ax - ex, 2) + Math.pow(ay - ey, 2));

        if (shift > this.config.layoutShiftThreshold) {
          alerts.push({
            timestamp: new Date().toISOString(),
            severity: shift > this.config.layoutShiftThreshold * 2 ? 'high' : 'medium',
            type: 'layout_shift',
            description: `Element ${anchorId} shifted by ${shift.toFixed(1)}px`,
            affectedElements: [anchorId],
            expected: expectedEl.bbox,
            actual: actualEl.bbox,
          });
        }
      }
    }

    // Also check elements matched by text
    for (const expectedEl of expected.elements) {
      if (!expectedEl.text) continue;

      const actualEl = actual.elements.find(
        (el) => el.text === expectedEl.text && el.role === expectedEl.role
      );

      if (actualEl) {
        const [ex, ey] = expectedEl.bbox;
        const [ax, ay] = actualEl.bbox;
        const shift = Math.sqrt(Math.pow(ax - ex, 2) + Math.pow(ay - ey, 2));

        if (shift > this.config.layoutShiftThreshold * 2) {
          // Higher threshold for non-anchor elements
          alerts.push({
            timestamp: new Date().toISOString(),
            severity: 'low',
            type: 'layout_shift',
            description: `Element "${expectedEl.text}" shifted by ${shift.toFixed(1)}px`,
            affectedElements: [expectedEl.id, actualEl.id],
            expected: expectedEl.bbox,
            actual: actualEl.bbox,
          });
        }
      }
    }

    return alerts;
  }

  /**
   * Check for text changes in key elements
   */
  private checkTextChanges(
    expected: UIMap,
    actual: UIMap
  ): DriftAlert[] {
    const alerts: DriftAlert[] = [];

    for (const anchorId of this.config.anchorElements) {
      const expectedEl = expected.elements.find((el) => el.id === anchorId);
      const actualEl = actual.elements.find((el) => el.id === anchorId);

      if (expectedEl && actualEl && expectedEl.text !== actualEl.text) {
        alerts.push({
          timestamp: new Date().toISOString(),
          severity: 'medium',
          type: 'text_change',
          description: `Text changed for ${anchorId}: "${expectedEl.text}" → "${actualEl.text}"`,
          affectedElements: [anchorId],
          expected: expectedEl.text,
          actual: actualEl.text,
        });
      }
    }

    return alerts;
  }

  /**
   * Check for new elements that weren't expected
   */
  private checkNewElements(
    expected: UIMap,
    actual: UIMap
  ): DriftAlert | null {
    const expectedIds = new Set(expected.elements.map((el) => el.id));
    const newElements = actual.elements.filter((el) => !expectedIds.has(el.id));

    // Only alert if there are many new elements
    if (newElements.length > expected.elements.length * 0.2) {
      return {
        timestamp: new Date().toISOString(),
        severity: 'low',
        type: 'new_element',
        description: `${newElements.length} new elements detected`,
        affectedElements: newElements.map((el) => el.id),
      };
    }

    return null;
  }

  /**
   * Check for removed elements
   */
  private checkRemovedElements(
    expected: UIMap,
    actual: UIMap
  ): DriftAlert | null {
    const actualIds = new Set(actual.elements.map((el) => el.id));
    const removedElements = expected.elements.filter(
      (el) => !actualIds.has(el.id)
    );

    // Only alert if there are many removed elements
    if (removedElements.length > expected.elements.length * 0.2) {
      return {
        timestamp: new Date().toISOString(),
        severity: 'medium',
        type: 'removed_element',
        description: `${removedElements.length} elements removed`,
        affectedElements: removedElements.map((el) => el.id),
      };
    }

    return null;
  }

  /**
   * Set anchor elements to monitor
   */
  setAnchorElements(elementIds: string[]): void {
    this.config.anchorElements = elementIds;
  }

  /**
   * Set anchor texts to monitor
   */
  setAnchorTexts(texts: string[]): void {
    this.config.anchorTexts = texts;
  }
}

