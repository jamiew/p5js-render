import { chromium, Browser, Page } from 'playwright';
import { SketchConfig, RenderOptions, FrameData, RenderResult } from './types.js';

export class P5Renderer {
  private browser: Browser | null = null;
  private page: Page | null = null;

  async initialize(): Promise<void> {
    this.browser = await chromium.launch({ headless: true });
    this.page = await this.browser.newPage();
  }

  async renderSketch(config: SketchConfig, options: RenderOptions = {}): Promise<RenderResult> {
    if (!this.page) {
      throw new Error('Renderer not initialized. Call initialize() first.');
    }

    const totalFrames = Math.ceil(config.frameRate * config.durationSeconds);
    const frames: FrameData[] = [];
    const startTime = Date.now();

    const htmlContent = this.createSketchHTML(config);
    await this.page.setContent(htmlContent, { waitUntil: 'networkidle' });
    await this.page.setViewportSize({ width: config.width, height: config.height });

    // Wait for p5.js to load and sketch to start
    await this.page.waitForFunction('window.p5 && window.sketchReady', { timeout: 10000 });

    for (let frameNumber = 0; frameNumber < totalFrames; frameNumber++) {
      // Set the frame number for deterministic rendering
      await this.page.evaluate((frame: number) => {
        (globalThis as any).currentFrame = frame;
      }, frameNumber);

      // Trigger a redraw
      await this.page.evaluate(() => {
        if ((globalThis as any).redraw) {
          (globalThis as any).redraw();
        }
      });

      // Small delay to ensure frame is rendered
      await this.page.waitForTimeout(16); // ~60fps worth of wait

      const screenshotOptions: any = {
        type: options.format || 'png',
        clip: { x: 0, y: 0, width: config.width, height: config.height }
      };
      
      if (options.quality !== undefined) {
        screenshotOptions.quality = options.quality;
      }
      
      const screenshot = await this.page.screenshot(screenshotOptions);

      frames.push({
        frameNumber,
        timestamp: frameNumber / config.frameRate,
        buffer: screenshot
      });
    }

    const durationMs = Date.now() - startTime;

    return {
      totalFrames,
      frames,
      durationMs
    };
  }

  private createSketchHTML(config: SketchConfig): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <script src="https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.7.0/p5.min.js"></script>
  <style>
    body { 
      margin: 0; 
      padding: 0; 
      overflow: hidden; 
      background: black;
    }
    canvas { 
      display: block; 
    }
  </style>
</head>
<body>
  <script>
    window.currentFrame = 0;
    window.sketchReady = false;
    
    // User sketch code first
    ${config.code}
    
    // Override setup and draw if they exist
    const userSetup = window.setup;
    const userDraw = window.draw;
    
    window.setup = function() {
      createCanvas(${config.width}, ${config.height});
      frameRate(${config.frameRate});
      
      // Call user setup if it exists
      if (userSetup) {
        userSetup();
      }
      
      window.sketchReady = true;
    };
    
    window.draw = function() {
      // Use our controlled frame counter
      frameCount = window.currentFrame + 1;
      
      // Call user draw if it exists
      if (userDraw) {
        userDraw();
      }
    };
  </script>
</body>
</html>`;
  }


  async cleanup(): Promise<void> {
    if (this.page) {
      await this.page.close();
      this.page = null;
    }
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}