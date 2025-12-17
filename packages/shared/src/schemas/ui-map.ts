import { z } from 'zod';

/**
 * UI Element roles detected by the perception service
 */
export const UIElementRoleSchema = z.enum([
  'button',
  'input',
  'menu',
  'icon',
  'text',
  'link',
  'table',
  'checkbox',
  'radio',
  'select',
  'textarea',
  'image',
  'card',
  'modal',
  'tab',
  'unknown',
]);

export type UIElementRole = z.infer<typeof UIElementRoleSchema>;

/**
 * Bounding box: [x, y, width, height]
 */
export const BBoxSchema = z.tuple([z.number(), z.number(), z.number(), z.number()]);

export type BBox = z.infer<typeof BBoxSchema>;

/**
 * Neighbor relationships for element anchoring
 */
export const NeighborsSchema = z.object({
  left: z.array(z.string()).default([]),
  right: z.array(z.string()).default([]),
  above: z.array(z.string()).default([]),
  below: z.array(z.string()).default([]),
});

export type Neighbors = z.infer<typeof NeighborsSchema>;

/**
 * Element signature for healing engine matching
 */
export const ElementSignatureSchema = z.object({
  semantic: z.object({
    text: z.string(),
    caption: z.string(),
    role: UIElementRoleSchema,
  }),
  visual: z
    .object({
      embeddingHash: z.string().optional(),
      cropReference: z.string().optional(),
    })
    .optional(),
  layout: z.object({
    normalizedBbox: BBoxSchema,
    neighborAnchors: z.array(z.string()),
  }),
});

export type ElementSignature = z.infer<typeof ElementSignatureSchema>;

/**
 * A single UI element detected in a screenshot
 */
export const UIElementSchema = z.object({
  /** Unique element ID within the UIMap (e.g., "E12") */
  id: z.string(),

  /** Bounding box: [x, y, width, height] */
  bbox: BBoxSchema,

  /** Element role/type */
  role: UIElementRoleSchema,

  /** Visible text content */
  text: z.string().default(''),

  /** Caption/description (from model) */
  caption: z.string().default(''),

  /** Detection confidence (0-1) */
  confidence: z.number().min(0).max(1),

  /** Whether the element can be interacted with */
  interactable: z.boolean(),

  /** Neighboring elements by direction */
  neighbors: NeighborsSchema,

  /** Optional attributes (href, placeholder, etc.) */
  attributes: z.record(z.string()).optional(),

  /** Element signature for healing */
  signature: ElementSignatureSchema.optional(),
});

export type UIElement = z.infer<typeof UIElementSchema>;

/**
 * Screen metadata
 */
export const ScreenMetadataSchema = z.object({
  /** Screen width in pixels */
  width: z.number().positive(),

  /** Screen height in pixels */
  height: z.number().positive(),

  /** ISO timestamp when screenshot was taken */
  timestamp: z.string().datetime(),

  /** SHA256 hash of the screenshot */
  hash: z.string(),

  /** Optional URL if web page */
  url: z.string().url().optional(),

  /** Optional page title */
  title: z.string().optional(),
});

export type ScreenMetadata = z.infer<typeof ScreenMetadataSchema>;

/**
 * Complete UIMap representing a parsed screenshot
 */
export const UIMapSchema = z.object({
  /** Screen metadata */
  screen: ScreenMetadataSchema,

  /** Detected UI elements */
  elements: z.array(UIElementSchema),

  /** Parser version that generated this map */
  parserVersion: z.string().default('omniparser-v1'),

  /** Additional metadata from perception service */
  metadata: z.record(z.unknown()).optional(),
});

export type UIMap = z.infer<typeof UIMapSchema>;

/**
 * Request to the perception service
 */
export const ParseRequestSchema = z.object({
  /** Base64 encoded screenshot image */
  image_base64: z.string(),

  /** Optional metadata for logging */
  metadata: z
    .object({
      test_id: z.string().optional(),
      env: z.string().optional(),
      step_name: z.string().optional(),
    })
    .optional(),
});

export type ParseRequest = z.infer<typeof ParseRequestSchema>;

/**
 * Response from the perception service
 */
export const ParseResponseSchema = UIMapSchema;

export type ParseResponse = z.infer<typeof ParseResponseSchema>;

// Utility functions

/**
 * Get element center point from bbox
 */
export function getElementCenter(bbox: BBox): { x: number; y: number } {
  const [x, y, width, height] = bbox;
  return {
    x: x + width / 2,
    y: y + height / 2,
  };
}

/**
 * Check if two bboxes overlap
 */
export function bboxOverlaps(a: BBox, b: BBox): boolean {
  const [ax, ay, aw, ah] = a;
  const [bx, by, bw, bh] = b;

  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

/**
 * Calculate normalized bbox (0-1 range based on screen dimensions)
 */
export function normalizeBbox(bbox: BBox, screenWidth: number, screenHeight: number): BBox {
  const [x, y, w, h] = bbox;
  return [x / screenWidth, y / screenHeight, w / screenWidth, h / screenHeight];
}

/**
 * Find element by ID in UIMap
 */
export function findElementById(uiMap: UIMap, id: string): UIElement | undefined {
  return uiMap.elements.find((el) => el.id === id);
}

/**
 * Find elements by role
 */
export function findElementsByRole(uiMap: UIMap, role: UIElementRole): UIElement[] {
  return uiMap.elements.filter((el) => el.role === role);
}

/**
 * Find interactable elements
 */
export function findInteractableElements(uiMap: UIMap): UIElement[] {
  return uiMap.elements.filter((el) => el.interactable);
}

/**
 * Find element by text (fuzzy match)
 */
export function findElementByText(
  uiMap: UIMap,
  text: string,
  options?: { exact?: boolean; role?: UIElementRole }
): UIElement | undefined {
  const normalizedText = text.toLowerCase().trim();

  return uiMap.elements.find((el) => {
    if (options?.role && el.role !== options.role) {
      return false;
    }

    const elementText = el.text.toLowerCase().trim();

    if (options?.exact) {
      return elementText === normalizedText;
    }

    return elementText.includes(normalizedText) || normalizedText.includes(elementText);
  });
}

