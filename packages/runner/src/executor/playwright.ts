/**
 * Playwright Executor - Executes actions on web pages using Playwright
 */

import { chromium, firefox, webkit, Browser, BrowserContext, Page } from 'playwright';
import type {
  TestAction,
  UIMap,
  UIElement,
  ActionResult,
  ActionResultStatus,
  BBox,
} from '@ui-automation/shared';
import { getElementCenter, findElementById } from '@ui-automation/shared';

export interface ExecutorConfig {
  browser: 'chromium' | 'firefox' | 'webkit';
  headless: boolean;
  viewport: { width: number; height: number };
  baseUrl?: string;
  slowMo?: number;
}

export const DEFAULT_EXECUTOR_CONFIG: ExecutorConfig = {
  browser: 'chromium',
  headless: true,
  viewport: { width: 1920, height: 1080 },
  slowMo: 0,
};

export class PlaywrightExecutor {
  private config: ExecutorConfig;
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;

  constructor(config: Partial<ExecutorConfig> = {}) {
    this.config = { ...DEFAULT_EXECUTOR_CONFIG, ...config };
  }

  /**
   * Initialize browser and page
   */
  async initialize(): Promise<void> {
    const launchOptions = {
      headless: this.config.headless,
      slowMo: this.config.slowMo,
    };

    switch (this.config.browser) {
      case 'firefox':
        this.browser = await firefox.launch(launchOptions);
        break;
      case 'webkit':
        this.browser = await webkit.launch(launchOptions);
        break;
      default:
        this.browser = await chromium.launch(launchOptions);
    }

    this.context = await this.browser.newContext({
      viewport: this.config.viewport,
    });

    this.page = await this.context.newPage();

    if (this.config.baseUrl) {
      await this.page.goto(this.config.baseUrl);
    }
  }

  /**
   * Close browser and cleanup
   */
  async cleanup(): Promise<void> {
    if (this.page) {
      await this.page.close();
      this.page = null;
    }
    if (this.context) {
      await this.context.close();
      this.context = null;
    }
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  /**
   * Get the current page instance
   */
  getPage(): Page {
    if (!this.page) {
      throw new Error('Executor not initialized. Call initialize() first.');
    }
    return this.page;
  }

  /**
   * Take a screenshot and return as base64
   */
  async takeScreenshot(): Promise<string> {
    const page = this.getPage();
    const buffer = await page.screenshot({ type: 'png' });
    return buffer.toString('base64');
  }

  /**
   * Get current URL
   */
  getCurrentUrl(): string {
    return this.getPage().url();
  }

  /**
   * Get page title
   */
  async getTitle(): Promise<string> {
    return await this.getPage().title();
  }

  /**
   * Execute a single action
   */
  async executeAction(action: TestAction, uiMap: UIMap): Promise<ActionResult> {
    const startTime = Date.now();
    const page = this.getPage();

    try {
      switch (action.type) {
        case 'CLICK':
          await this.executeClick(action, uiMap);
          break;

        case 'DOUBLE_CLICK':
          await this.executeDoubleClick(action, uiMap);
          break;

        case 'RIGHT_CLICK':
          await this.executeRightClick(action, uiMap);
          break;

        case 'TYPE':
          await this.executeType(action, uiMap);
          break;

        case 'CLEAR':
          await this.executeClear(action, uiMap);
          break;

        case 'HOVER':
          await this.executeHover(action, uiMap);
          break;

        case 'SELECT':
          await this.executeSelect(action, uiMap);
          break;

        case 'SCROLL':
          await this.executeScroll(action, uiMap);
          break;

        case 'WAIT':
          await this.executeWait(action);
          break;

        case 'ASSERT':
          await this.executeAssert(action, uiMap);
          break;

        case 'NAVIGATE':
          await this.executeNavigate(action);
          break;

        case 'PRESS_KEY':
          await this.executePressKey(action);
          break;

        case 'SCREENSHOT':
          await this.takeScreenshot();
          break;

        default:
          throw new Error(`Unknown action type: ${(action as any).type}`);
      }

      return {
        action,
        status: 'success',
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        action,
        status: 'failure',
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Get element from UIMap and return its center coordinates
   * Supports:
   * - ID lookup: "E001"
   * - Text-based lookup: "text:Sign In" (finds element containing text in text or caption)
   * - Role+text lookup: "button:Sign In" (finds button with text)
   */
  private getElementPosition(
    targetId: string,
    uiMap: UIMap
  ): { x: number; y: number } {
    let element: UIElement | undefined;

    // Helper to check if element matches search text (checks both text and caption)
    const matchesText = (el: UIElement, searchText: string): boolean => {
      const textMatch = el.text.toLowerCase().includes(searchText);
      const captionMatch = el.caption.toLowerCase().includes(searchText);
      return textMatch || captionMatch;
    };

    // Check for text-based selector: "text:Some Text"
    if (targetId.startsWith('text:')) {
      const searchText = targetId.slice(5).toLowerCase().trim();
      
      // Try exact includes match first
      element = uiMap.elements.find((el) => matchesText(el, searchText));
      
      // If not found, try matching individual words
      if (!element) {
        const words = searchText.split(/\s+/).filter(w => w.length > 2);
        element = uiMap.elements.find((el) => 
          words.every(word => matchesText(el, word))
        );
      }
      
      // If still not found, try partial word match
      if (!element) {
        const words = searchText.split(/\s+/).filter(w => w.length > 2);
        element = uiMap.elements.find((el) => 
          words.some(word => matchesText(el, word))
        );
      }
      
      if (!element) {
        // Log available elements for debugging
        const availableTexts = uiMap.elements
          .map((el) => `"${el.text}" (${el.role})`)
          .join(', ');
        throw new Error(
          `Element with text "${searchText}" not found. ` +
          `Available elements: ${availableTexts}`
        );
      }
    }
    // Check for role+text selector: "button:Sign In", "input:Email"
    else if (targetId.includes(':')) {
      const colonIndex = targetId.indexOf(':');
      const role = targetId.slice(0, colonIndex);
      const searchText = targetId.slice(colonIndex + 1).toLowerCase().trim();
      
      // Try to find element matching role and text
      element = uiMap.elements.find(
        (el) => el.role === role && matchesText(el, searchText)
      );
      
      if (!element) {
        // Fallback: try matching just by text if role doesn't match
        element = uiMap.elements.find((el) => matchesText(el, searchText));
      }
      
      if (!element) {
        const availableTexts = uiMap.elements
          .map((el) => `"${el.text}" (${el.role})`)
          .join(', ');
        throw new Error(
          `Element with role "${role}" and text "${searchText}" not found. ` +
          `Available elements: ${availableTexts}`
        );
      }
    }
    // Standard ID lookup
    else {
      element = findElementById(uiMap, targetId);
      if (!element) {
        throw new Error(`Element not found: ${targetId}`);
      }
    }

    return getElementCenter(element.bbox);
  }

  private async executeClick(action: TestAction, uiMap: UIMap): Promise<void> {
    if (!action.target) {
      throw new Error('CLICK action requires target');
    }
    
    // Support selector-based clicking: "selector:button[type='submit']" or "css:button"
    if (action.target.startsWith('selector:') || action.target.startsWith('css:')) {
      const selector = action.target.replace(/^(selector:|css:)/, '');
      await this.getPage().locator(selector).click();
      return;
    }
    
    // Support xpath-based clicking: "xpath://button"
    if (action.target.startsWith('xpath:')) {
      const xpath = action.target.replace(/^xpath:/, '');
      await this.getPage().locator(`xpath=${xpath}`).click();
      return;
    }
    
    // Support text-based locator clicking using Playwright's getByRole: "locator:Sign In"
    if (action.target.startsWith('locator:')) {
      const text = action.target.replace(/^locator:/, '');
      await this.getPage().getByRole('button', { name: text }).click();
      return;
    }
    
    // Support text-based clicking using Playwright's getByText: "bytext:Logout"
    if (action.target.startsWith('bytext:')) {
      const text = action.target.replace(/^bytext:/, '');
      const page = this.getPage();
      // Find button containing the text and click it
      await page.locator('button').filter({ hasText: text }).click();
      return;
    }
    
    // Fallback to coordinate-based clicking
    const { x, y } = this.getElementPosition(action.target, uiMap);
    console.log(`[DEBUG] Clicking at coordinates: (${x}, ${y}) for target: ${action.target}`);
    
    // Try JavaScript-based click at coordinates, finding the nearest clickable parent (button/a/input)
    const clickResult = await this.getPage().evaluate(`
      (function() {
        let element = document.elementFromPoint(${x}, ${y});
        if (!element) {
          return { success: false, reason: 'no element at coordinates' };
        }
        
        // Find the nearest button, anchor, or input parent
        const clickableParent = element.closest('button, a, [role="button"], input[type="button"], input[type="submit"]');
        const targetElement = clickableParent || element;
        
        console.log('[JS] Found element at (${x}, ${y}):', element.tagName);
        console.log('[JS] Clicking:', targetElement.tagName, targetElement.textContent?.slice(0, 50));
        
        targetElement.click();
        return { 
          success: true, 
          element: element.tagName, 
          clickedElement: targetElement.tagName,
          text: targetElement.textContent?.slice(0, 50)
        };
      })()
    `);
    console.log(`[DEBUG] Click result:`, clickResult);
  }

  private async executeDoubleClick(action: TestAction, uiMap: UIMap): Promise<void> {
    if (!action.target) {
      throw new Error('DOUBLE_CLICK action requires target');
    }
    const { x, y } = this.getElementPosition(action.target, uiMap);
    await this.getPage().mouse.dblclick(x, y);
  }

  private async executeRightClick(action: TestAction, uiMap: UIMap): Promise<void> {
    if (!action.target) {
      throw new Error('RIGHT_CLICK action requires target');
    }
    const { x, y } = this.getElementPosition(action.target, uiMap);
    await this.getPage().mouse.click(x, y, { button: 'right' });
  }

  private async executeType(action: TestAction, uiMap: UIMap): Promise<void> {
    if (!action.target) {
      throw new Error('TYPE action requires target');
    }
    if (!action.text) {
      throw new Error('TYPE action requires text');
    }

    // Support selector-based typing: "selector:input[type='email']"
    if (action.target.startsWith('selector:') || action.target.startsWith('css:')) {
      const selector = action.target.replace(/^(selector:|css:)/, '');
      await this.getPage().locator(selector).first().fill(action.text);
      return;
    }

    // Support xpath-based typing: "xpath://input"
    if (action.target.startsWith('xpath:')) {
      const xpath = action.target.replace(/^xpath:/, '');
      await this.getPage().locator(`xpath=${xpath}`).first().fill(action.text);
      return;
    }

    // Support Playwright's getByLabel: "label:Email"
    if (action.target.startsWith('label:')) {
      const label = action.target.replace(/^label:/, '');
      await this.getPage().getByLabel(label, { exact: false }).fill(action.text);
      return;
    }

    // Support Playwright's getByPlaceholder: "placeholder:Enter email"
    if (action.target.startsWith('placeholder:')) {
      const placeholder = action.target.replace(/^placeholder:/, '');
      await this.getPage().getByPlaceholder(placeholder, { exact: false }).fill(action.text);
      return;
    }

    // Fallback to coordinate-based typing
    const { x, y } = this.getElementPosition(action.target, uiMap);
    await this.getPage().mouse.click(x, y);
    await this.getPage().keyboard.type(action.text);
  }

  private async executeClear(action: TestAction, uiMap: UIMap): Promise<void> {
    if (!action.target) {
      throw new Error('CLEAR action requires target');
    }
    const { x, y } = this.getElementPosition(action.target, uiMap);
    await this.getPage().mouse.click(x, y);
    await this.getPage().keyboard.press('Control+a');
    await this.getPage().keyboard.press('Backspace');
  }

  private async executeHover(action: TestAction, uiMap: UIMap): Promise<void> {
    if (!action.target) {
      throw new Error('HOVER action requires target');
    }
    const { x, y } = this.getElementPosition(action.target, uiMap);
    await this.getPage().mouse.move(x, y);
  }

  private async executeSelect(action: TestAction, uiMap: UIMap): Promise<void> {
    if (!action.target) {
      throw new Error('SELECT action requires target');
    }
    if (!action.option) {
      throw new Error('SELECT action requires option');
    }
    // Click on the select element, then we'd need to handle the dropdown
    // For now, using a coordinate-based approach
    const { x, y } = this.getElementPosition(action.target, uiMap);
    await this.getPage().mouse.click(x, y);
    // Type the option and press enter
    await this.getPage().keyboard.type(action.option);
    await this.getPage().keyboard.press('Enter');
  }

  private async executeScroll(action: TestAction, uiMap: UIMap): Promise<void> {
    const page = this.getPage();
    const amount = action.amount ?? 300;

    let x = page.viewportSize()?.width ?? 960;
    let y = page.viewportSize()?.height ?? 540;
    x = x / 2;
    y = y / 2;

    if (action.target) {
      const pos = this.getElementPosition(action.target, uiMap);
      x = pos.x;
      y = pos.y;
    }

    let deltaX = 0;
    let deltaY = 0;

    switch (action.direction) {
      case 'up':
        deltaY = -amount;
        break;
      case 'down':
        deltaY = amount;
        break;
      case 'left':
        deltaX = -amount;
        break;
      case 'right':
        deltaX = amount;
        break;
    }

    await page.mouse.move(x, y);
    await page.mouse.wheel(deltaX, deltaY);
  }

  private async executeWait(action: TestAction): Promise<void> {
    const ms = action.ms ?? 1000;
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async executeAssert(action: TestAction, uiMap: UIMap): Promise<void> {
    if (!action.predicate) {
      throw new Error('ASSERT action requires predicate');
    }

    const page = this.getPage();
    const predicate = action.predicate;

    switch (predicate.kind) {
      case 'TEXT_EXISTS':
        if (!predicate.value) {
          throw new Error('TEXT_EXISTS requires value');
        }
        const textExists = uiMap.elements.some((el) =>
          el.text.toLowerCase().includes(String(predicate.value).toLowerCase())
        );
        if (!textExists) {
          throw new Error(`Text not found: ${predicate.value}`);
        }
        break;

      case 'TEXT_NOT_EXISTS':
        if (!predicate.value) {
          throw new Error('TEXT_NOT_EXISTS requires value');
        }
        const textNotExists = !uiMap.elements.some((el) =>
          el.text.toLowerCase().includes(String(predicate.value).toLowerCase())
        );
        if (!textNotExists) {
          throw new Error(`Text found but should not exist: ${predicate.value}`);
        }
        break;

      case 'ELEMENT_EXISTS':
        if (!predicate.target) {
          throw new Error('ELEMENT_EXISTS requires target');
        }
        const elementExists = findElementById(uiMap, predicate.target);
        if (!elementExists) {
          throw new Error(`Element not found: ${predicate.target}`);
        }
        break;

      case 'ELEMENT_NOT_EXISTS':
        if (!predicate.target) {
          throw new Error('ELEMENT_NOT_EXISTS requires target');
        }
        const elementNotExists = !findElementById(uiMap, predicate.target);
        if (!elementNotExists) {
          throw new Error(`Element found but should not exist: ${predicate.target}`);
        }
        break;

      case 'URL_CONTAINS':
        if (!predicate.value) {
          throw new Error('URL_CONTAINS requires value');
        }
        const url = page.url();
        if (!url.includes(String(predicate.value))) {
          throw new Error(`URL does not contain: ${predicate.value}. Current URL: ${url}`);
        }
        break;

      case 'URL_NOT_CONTAINS':
        if (!predicate.value) {
          throw new Error('URL_NOT_CONTAINS requires value');
        }
        const currentUrl = page.url();
        if (currentUrl.includes(String(predicate.value))) {
          throw new Error(`URL should not contain: ${predicate.value}. Current URL: ${currentUrl}`);
        }
        break;

      case 'TITLE_CONTAINS':
        if (!predicate.value) {
          throw new Error('TITLE_CONTAINS requires value');
        }
        const title = await page.title();
        if (!title.includes(String(predicate.value))) {
          throw new Error(`Title does not contain: ${predicate.value}. Current title: ${title}`);
        }
        break;

      case 'ELEMENT_COUNT':
        if (predicate.value === undefined) {
          throw new Error('ELEMENT_COUNT requires value');
        }
        const count = uiMap.elements.length;
        const expectedCount = Number(predicate.value);
        const op = predicate.operator ?? 'eq';

        let countMatches = false;
        switch (op) {
          case 'eq':
            countMatches = count === expectedCount;
            break;
          case 'gt':
            countMatches = count > expectedCount;
            break;
          case 'lt':
            countMatches = count < expectedCount;
            break;
          case 'gte':
            countMatches = count >= expectedCount;
            break;
          case 'lte':
            countMatches = count <= expectedCount;
            break;
        }

        if (!countMatches) {
          throw new Error(
            `Element count ${count} does not match ${op} ${expectedCount}`
          );
        }
        break;

      default:
        throw new Error(`Unknown assertion kind: ${predicate.kind}`);
    }
  }

  private async executeNavigate(action: TestAction): Promise<void> {
    if (!action.url) {
      throw new Error('NAVIGATE action requires url');
    }
    await this.getPage().goto(action.url, { waitUntil: 'networkidle' });
  }

  private async executePressKey(action: TestAction): Promise<void> {
    if (!action.key) {
      throw new Error('PRESS_KEY action requires key');
    }
    await this.getPage().keyboard.press(action.key);
  }
}

