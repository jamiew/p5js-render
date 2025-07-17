import { chromium, Browser, Page, PageScreenshotOptions, BrowserContext } from 'playwright';
import { SketchConfig, RenderOptions, FrameData, RenderResult } from './types.js';
import { cpus } from 'os';

export class P5Renderer {
  private browser: Browser | null = null;
  private static sharedBrowser: Browser | null = null;
  private static browserRefCount = 0;

  private parseCanvasDimensions(code: string): { width: number; height: number } | null {
    // Look for createCanvas calls in the code
    const createCanvasRegex = /createCanvas\s*\(\s*(\d+)\s*,\s*(\d+)/;
    const match = code.match(createCanvasRegex);
    
    if (match) {
      const width = parseInt(match[1], 10);
      const height = parseInt(match[2], 10);
      
      // Validate dimensions are reasonable
      if (width > 0 && height > 0 && width <= 4096 && height <= 4096) {
        return { width, height };
      }
    }
    
    return null;
  }

  async initialize(): Promise<void> {
    if (!P5Renderer.sharedBrowser) {
      P5Renderer.sharedBrowser = await chromium.launch({ 
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--disable-software-rasterizer',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding'
        ]
      });
    }
    P5Renderer.browserRefCount++;
    this.browser = P5Renderer.sharedBrowser;
  }

  async renderSketch(config: SketchConfig, options: RenderOptions = {}): Promise<RenderResult> {
    if (!this.browser) {
      throw new Error('Renderer not initialized. Call initialize() first.');
    }

    // Parse canvas dimensions from the sketch code if available
    const parsedDimensions = this.parseCanvasDimensions(config.code);
    const actualConfig = parsedDimensions 
      ? { ...config, width: parsedDimensions.width, height: parsedDimensions.height }
      : config;

    const totalFrames = Math.ceil(actualConfig.frameRate * actualConfig.durationSeconds);
    const startTime = Date.now();

    // Determine optimal concurrency based on CPU cores and frame count
    const cpuCount = cpus().length;
    const maxConcurrency = Math.min(cpuCount * 2, Math.max(2, Math.ceil(totalFrames / 6)));
    const frameNumbers = Array.from({ length: totalFrames }, (_, i) => i);
    
    // Distribute frames more evenly across contexts
    const chunks = this.distributeFrames(frameNumbers, maxConcurrency);

    const frames: FrameData[] = [];

    // Process chunks in parallel with optimized contexts
    const chunkPromises = chunks.map(async (chunk) => {
      const context = await this.browser!.newContext({
        viewport: { width: actualConfig.width, height: actualConfig.height }
      });
      const page = await context.newPage();
      
      try {
        // Set optimized page settings
        await page.setExtraHTTPHeaders({
          'Cache-Control': 'no-cache'
        });

        const htmlContent = this.createOptimizedSketchHTML(actualConfig);
        await page.setContent(htmlContent, { waitUntil: 'domcontentloaded' });

        // Wait for p5.js to load and sketch to start with shorter timeout
        await page.waitForFunction('window.p5 && window.sketchReady', { timeout: 5000 });

        const chunkFrames: FrameData[] = [];

        // Process all frames in this chunk efficiently
        for (const frameNumber of chunk) {
          // Batch frame setup and rendering in one evaluate call
          await page.evaluate((frame: number) => {
            globalThis.currentFrame = frame;
            if (globalThis.redraw) {
              globalThis.redraw();
            }
          }, frameNumber);

          const screenshotOptions: PageScreenshotOptions = {
            type: options.format || 'jpeg', // Default to JPEG for speed
            clip: { x: 0, y: 0, width: actualConfig.width, height: actualConfig.height },
            quality: options.quality || 80, // Optimized quality vs speed
            animations: 'disabled' // Disable CSS animations
          };
          
          const screenshot = await page.screenshot(screenshotOptions);

          chunkFrames.push({
            frameNumber,
            timestamp: frameNumber / actualConfig.frameRate,
            buffer: screenshot
          });
        }

        return chunkFrames;
      } finally {
        await context.close();
      }
    });

    // Wait for all chunks to complete and flatten results
    const chunkResults = await Promise.all(chunkPromises);
    for (const chunkFrames of chunkResults) {
      frames.push(...chunkFrames);
    }

    // Sort frames by frame number to ensure correct order
    frames.sort((a, b) => a.frameNumber - b.frameNumber);

    const durationMs = Date.now() - startTime;

    return {
      totalFrames,
      frames,
      durationMs
    };
  }

  private distributeFrames(frames: number[], numChunks: number): number[][] {
    // Round-robin distribution for better load balancing
    const chunks: number[][] = Array.from({ length: numChunks }, () => []);
    frames.forEach((frame, index) => {
      chunks[index % numChunks].push(frame);
    });
    return chunks.filter(chunk => chunk.length > 0);
  }

  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  private createOptimizedSketchHTML(config: SketchConfig): string {
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
      image-rendering: optimizeSpeed;
      image-rendering: -moz-crisp-edges;
      image-rendering: -webkit-optimize-contrast;
      image-rendering: crisp-edges;
      image-rendering: pixelated;
    }
  </style>
</head>
<body>
  <script>
    window.currentFrame = 0;
    window.sketchReady = false;
    
    // Performance optimizations
    if (window.performance && window.performance.mark) {
      window.performance.mark('sketch-start');
    }
    
    // User sketch code first
    ${config.code}
    
    // Override setup and draw if they exist
    const userSetup = window.setup;
    const userDraw = window.draw;
    
    window.setup = function() {
      createCanvas(${config.width}, ${config.height});
      frameRate(${config.frameRate});
      
      // Disable loops to prevent unwanted redraws
      noLoop();
      
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

  private createSketchHTML(config: SketchConfig): string {
    return this.createOptimizedSketchHTML(config);
  }


  async cleanup(): Promise<void> {
    P5Renderer.browserRefCount--;
    
    // Only close shared browser when no more instances are using it
    if (P5Renderer.browserRefCount <= 0 && P5Renderer.sharedBrowser) {
      await P5Renderer.sharedBrowser.close();
      P5Renderer.sharedBrowser = null;
      P5Renderer.browserRefCount = 0;
    }
    
    this.browser = null;
  }
}