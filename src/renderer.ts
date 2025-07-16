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
    await this.page.setContent(htmlContent);
    await this.page.setViewportSize({ width: config.width, height: config.height });

    // Wait for p5.js to load and sketch to start
    await this.page.waitForFunction('window.p5 && window.sketchReady', { timeout: 10000 });

    for (let frameNumber = 0; frameNumber < totalFrames; frameNumber++) {
      // Set the frame number for deterministic rendering
      await this.page.evaluate((frame) => {
        (window as any).currentFrame = frame;
      }, frameNumber);

      // Trigger a redraw
      await this.page.evaluate(() => {
        if ((window as any).redraw) {
          (window as any).redraw();
        }
      });

      // Small delay to ensure frame is rendered
      await this.page.waitForTimeout(16); // ~60fps worth of wait

      const screenshot = await this.page.screenshot({
        type: options.format || 'png',
        quality: options.quality,
        clip: { x: 0, y: 0, width: config.width, height: config.height }
      });

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
    
    // Override frameCount to use our custom frame counter
    let originalDraw;
    
    function setup() {
      createCanvas(${config.width}, ${config.height});
      frameRate(${config.frameRate});
      
      // Execute user sketch setup
      ${this.extractSetupFunction(config.code)}
      
      window.sketchReady = true;
    }
    
    function draw() {
      // Use our controlled frame counter
      frameCount = window.currentFrame + 1;
      
      // Execute user sketch draw
      ${this.extractDrawFunction(config.code)}
    }
    
    // User sketch code (functions will be extracted)
    ${config.code}
  </script>
</body>
</html>`;
  }

  private extractSetupFunction(code: string): string {
    const setupMatch = code.match(/function\s+setup\s*\([^)]*\)\s*\{([\s\S]*?)\}/);
    return setupMatch ? setupMatch[1] : '';
  }

  private extractDrawFunction(code: string): string {
    const drawMatch = code.match(/function\s+draw\s*\([^)]*\)\s*\{([\s\S]*?)\}/);
    return drawMatch ? drawMatch[1] : '';
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