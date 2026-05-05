import { readFileSync } from 'fs';
import { createRequire } from 'module';
import { dirname, join, resolve } from 'path';
import { cpus } from 'os';
import { chromium, Browser, Page, PageScreenshotOptions } from 'playwright';
import {
  CAPTURE_METHODS,
  IMAGE_FORMATS,
  SketchConfig,
  RenderOptions,
  FrameData,
  RenderResult
} from './types.js';

const require = createRequire(import.meta.url);

export const DEFAULT_TIMEOUT_MS = 30000;
export const DEFAULT_PIXEL_DENSITY = 1;
export const MAX_CANVAS_DIMENSION = 8192;
export const MAX_TOTAL_FRAMES = 60 * 60 * 10;

type P5ScriptSource = {
  tag: string;
  description: string;
};

export function parseCanvasDimensions(
  code: string
): { width: number; height: number } | null {
  const createCanvasRegex = /createCanvas\s*\(\s*(\d+)\s*,\s*(\d+)/;
  const match = code.match(createCanvasRegex);

  if (!match) {
    return null;
  }

  const width = Number.parseInt(match[1], 10);
  const height = Number.parseInt(match[2], 10);

  if (isValidDimension(width) && isValidDimension(height)) {
    return { width, height };
  }

  return null;
}

export function resolveRenderConfig(config: SketchConfig): SketchConfig {
  const parsedDimensions = parseCanvasDimensions(config.code);
  const resolvedConfig = parsedDimensions
    ? {
        ...config,
        width: parsedDimensions.width,
        height: parsedDimensions.height
      }
    : config;

  validateRenderConfig(resolvedConfig);
  return resolvedConfig;
}

export function validateRenderConfig(config: SketchConfig): void {
  if (!config.code.trim()) {
    throw new Error('Sketch code is required.');
  }

  if (!isValidDimension(config.width) || !isValidDimension(config.height)) {
    throw new Error(
      `Canvas dimensions must be between 1 and ${MAX_CANVAS_DIMENSION} pixels.`
    );
  }

  if (
    !Number.isFinite(config.frameRate) ||
    config.frameRate <= 0 ||
    config.frameRate > 240
  ) {
    throw new Error('frameRate must be greater than 0 and no more than 240.');
  }

  if (!Number.isFinite(config.durationSeconds) || config.durationSeconds <= 0) {
    throw new Error('durationSeconds must be greater than 0.');
  }

  if (getTotalFrames(config) > MAX_TOTAL_FRAMES) {
    throw new Error(
      `Render is too large. Limit is ${MAX_TOTAL_FRAMES} total frames.`
    );
  }

  if (
    config.pixelDensity !== undefined &&
    (!Number.isFinite(config.pixelDensity) ||
      config.pixelDensity <= 0 ||
      config.pixelDensity > 4)
  ) {
    throw new Error('pixelDensity must be greater than 0 and no more than 4.');
  }
}

export function validateRenderOptions(options: RenderOptions): void {
  if (options.format !== undefined && !IMAGE_FORMATS.includes(options.format)) {
    throw new Error('format must be png or jpeg.');
  }

  if (
    options.quality !== undefined &&
    (!Number.isFinite(options.quality) ||
      options.quality < 0 ||
      options.quality > 100)
  ) {
    throw new Error('quality must be between 0 and 100.');
  }

  if (
    options.maxConcurrency !== undefined &&
    (!Number.isInteger(options.maxConcurrency) || options.maxConcurrency < 1)
  ) {
    throw new Error('maxConcurrency must be a positive integer.');
  }

  if (
    options.captureMethod !== undefined &&
    !CAPTURE_METHODS.includes(options.captureMethod)
  ) {
    throw new Error('captureMethod must be canvas or screenshot.');
  }

  if (
    options.timeoutMs !== undefined &&
    (!Number.isFinite(options.timeoutMs) || options.timeoutMs <= 0)
  ) {
    throw new Error('timeoutMs must be greater than 0.');
  }

  if (options.p5ScriptUrl !== undefined) {
    validateScriptUrl(options.p5ScriptUrl);
  }

  if (
    options.p5ScriptPath !== undefined &&
    options.p5ScriptPath.trim() === ''
  ) {
    throw new Error('p5ScriptPath must not be empty.');
  }
}

export function getTotalFrames(config: SketchConfig): number {
  return Math.ceil(config.frameRate * config.durationSeconds);
}

export function createSketchHTML(
  config: SketchConfig,
  options: RenderOptions = {}
): string {
  validateRenderOptions(options);

  const p5Source = createP5ScriptSource(options);
  const backgroundColor = config.backgroundColor ?? 'black';
  const pixelDensity = config.pixelDensity ?? DEFAULT_PIXEL_DENSITY;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  ${p5Source.tag}
  <style>
    html, body {
      width: ${config.width}px;
      height: ${config.height}px;
      margin: 0;
      padding: 0;
      overflow: hidden;
      background: ${backgroundColor};
    }

    canvas {
      display: block;
    }
  </style>
</head>
<body>
  <script>
    window.__p5RenderReady = false;
    window.__p5RenderCurrentFrame = 0;
    window.__p5Runtime = ${JSON.stringify(p5Source.description)};
    window.__p5RenderOptions = ${JSON.stringify({
      width: config.width,
      height: config.height,
      frameRate: config.frameRate,
      pixelDensity
    })};

    if (window.performance && window.performance.mark) {
      window.performance.mark('p5-render-start');
    }
  </script>
  <script>
${escapeInlineScript(config.code)}
  </script>
  <script>
    const __p5UserSetup = window.setup;
    const __p5UserDraw = window.draw;

    window.setup = function setup() {
      pixelDensity(${pixelDensity});
      frameRate(${config.frameRate});

      if (__p5UserSetup) {
        __p5UserSetup.call(this);
      }

      if (!document.querySelector('canvas')) {
        createCanvas(${config.width}, ${config.height});
      }

      noLoop();
      window.__p5RenderReady = true;
    };

    window.draw = function draw() {
      const frameNumber = window.__p5RenderCurrentFrame || 0;
      frameCount = frameNumber + 1;
      window.frameCount = frameNumber + 1;

      if (__p5UserDraw) {
        __p5UserDraw.call(this);
      }
    };

    window.__p5RenderFrame = async function renderFrame(frameNumber) {
      window.__p5RenderCurrentFrame = frameNumber;
      redraw();
    };
  </script>
</body>
</html>`;
}

export class P5Renderer {
  private browser: Browser | null = null;
  private static sharedBrowser: Browser | null = null;
  private static browserLaunchPromise: Promise<Browser> | null = null;
  private static browserRefCount = 0;

  async initialize(): Promise<void> {
    if (this.browser) {
      return;
    }

    if (!P5Renderer.sharedBrowser) {
      P5Renderer.browserLaunchPromise ??= chromium.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-dev-shm-usage',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding'
        ]
      });

      try {
        P5Renderer.sharedBrowser = await P5Renderer.browserLaunchPromise;
      } catch (error) {
        P5Renderer.browserLaunchPromise = null;
        throw error;
      }
      P5Renderer.browserLaunchPromise = null;
    }

    P5Renderer.browserRefCount++;
    this.browser = P5Renderer.sharedBrowser;
  }

  async renderSketch(
    config: SketchConfig,
    options: RenderOptions = {}
  ): Promise<RenderResult> {
    if (!this.browser) {
      throw new Error('Renderer not initialized. Call initialize() first.');
    }

    const actualConfig = resolveRenderConfig(config);
    validateRenderOptions(options);

    const totalFrames = getTotalFrames(actualConfig);
    const startTime = Date.now();
    const maxConcurrency = getMaxConcurrency(
      totalFrames,
      options.maxConcurrency
    );
    const frameNumbers = Array.from(
      { length: totalFrames },
      (_, index) => index
    );
    const chunks = distributeFrames(frameNumbers, maxConcurrency);

    const chunkResults = await Promise.all(
      chunks.map(async (chunk) => {
        return await this.renderFrameChunk(actualConfig, chunk, options);
      })
    );

    const frames = chunkResults
      .flat()
      .sort((a, b) => a.frameNumber - b.frameNumber);

    return {
      totalFrames,
      frames,
      durationMs: Date.now() - startTime
    };
  }

  async renderFrame(
    config: SketchConfig,
    frameNumber: number,
    options: RenderOptions = {}
  ): Promise<FrameData> {
    if (!this.browser) {
      throw new Error('Renderer not initialized. Call initialize() first.');
    }

    const actualConfig = resolveRenderConfig(config);
    validateRenderOptions(options);

    const [frame] = await this.renderFrameChunk(
      actualConfig,
      [frameNumber],
      options
    );
    return frame;
  }

  private async renderFrameChunk(
    config: SketchConfig,
    frameNumbers: number[],
    options: RenderOptions
  ): Promise<FrameData[]> {
    const context = await this.browser!.newContext({
      viewport: { width: config.width, height: config.height },
      deviceScaleFactor: 1
    });
    const page = await context.newPage();

    try {
      await preparePage(page, config, options);

      const frames: FrameData[] = [];
      for (const frameNumber of frameNumbers) {
        const buffer = await captureFrame(page, config, frameNumber, options);
        frames.push({
          frameNumber,
          timestamp: frameNumber / config.frameRate,
          buffer
        });
      }

      return frames;
    } finally {
      await context.close();
    }
  }

  async cleanup(): Promise<void> {
    if (!this.browser) {
      return;
    }

    P5Renderer.browserRefCount--;

    if (P5Renderer.browserRefCount <= 0 && P5Renderer.sharedBrowser) {
      await P5Renderer.sharedBrowser.close();
      P5Renderer.sharedBrowser = null;
      P5Renderer.browserLaunchPromise = null;
      P5Renderer.browserRefCount = 0;
    }

    this.browser = null;
  }
}

async function preparePage(
  page: Page,
  config: SketchConfig,
  options: RenderOptions
): Promise<void> {
  const htmlContent = createSketchHTML(config, options);
  await page.setContent(htmlContent, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction('window.p5 && window.__p5RenderReady === true', {
    timeout: options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  });
}

async function captureFrame(
  page: Page,
  config: SketchConfig,
  frameNumber: number,
  options: RenderOptions
): Promise<Buffer> {
  if (options.captureMethod === 'screenshot') {
    return await captureFrameScreenshot(page, config, frameNumber, options);
  }

  try {
    return await captureFrameCanvas(page, frameNumber, options);
  } catch (error) {
    if (options.captureMethod === 'canvas') {
      throw error;
    }
    return await captureFrameScreenshot(page, config, frameNumber, options);
  }
}

async function captureFrameCanvas(
  page: Page,
  frameNumber: number,
  options: RenderOptions
): Promise<Buffer> {
  const dataUrl = await page.evaluate(
    async ({ frame, format, quality }) => {
      await window.__p5RenderFrame(frame);

      const canvas = document.querySelector('canvas');
      if (!canvas) {
        throw new Error('Sketch did not create a canvas.');
      }

      const mimeType = format === 'jpeg' ? 'image/jpeg' : 'image/png';
      return canvas.toDataURL(mimeType, quality);
    },
    {
      frame: frameNumber,
      format: options.format ?? 'png',
      quality: normalizeCanvasQuality(options.quality)
    }
  );

  const base64Data = dataUrl.split(',')[1];
  if (!base64Data) {
    throw new Error('Canvas capture did not return image data.');
  }

  return Buffer.from(base64Data, 'base64');
}

async function captureFrameScreenshot(
  page: Page,
  config: SketchConfig,
  frameNumber: number,
  options: RenderOptions
): Promise<Buffer> {
  await page.evaluate(async (frame) => {
    await window.__p5RenderFrame(frame);
  }, frameNumber);

  const screenshotOptions: PageScreenshotOptions = {
    type: options.format ?? 'png',
    clip: { x: 0, y: 0, width: config.width, height: config.height },
    animations: 'disabled'
  };

  if (options.format === 'jpeg' && options.quality !== undefined) {
    screenshotOptions.quality = options.quality;
  }

  return await page.screenshot(screenshotOptions);
}

function createP5ScriptSource(options: RenderOptions): P5ScriptSource {
  if (options.p5ScriptUrl) {
    return {
      tag: `<script src="${escapeHtmlAttribute(options.p5ScriptUrl)}"></script>`,
      description: options.p5ScriptUrl
    };
  }

  if (options.p5Version) {
    const url = `https://cdn.jsdelivr.net/npm/p5@${encodeURIComponent(options.p5Version)}/lib/p5.min.js`;
    return {
      tag: `<script src="${url}"></script>`,
      description: url
    };
  }

  const p5ScriptPath = options.p5ScriptPath
    ? resolve(options.p5ScriptPath)
    : getLocalP5ScriptPath();
  const p5Code = readFileSync(p5ScriptPath, 'utf8');

  return {
    tag: `<script>${escapeInlineScript(p5Code)}</script>`,
    description: options.p5ScriptPath
      ? p5ScriptPath
      : `local p5 package ${getLocalP5Version()}`
  };
}

function distributeFrames(frames: number[], numChunks: number): number[][] {
  const chunks: number[][] = Array.from({ length: numChunks }, () => []);
  frames.forEach((frame, index) => {
    chunks[index % numChunks].push(frame);
  });
  return chunks.filter((chunk) => chunk.length > 0);
}

function getMaxConcurrency(totalFrames: number, requested?: number): number {
  if (requested !== undefined) {
    if (!Number.isInteger(requested) || requested < 1) {
      throw new Error('maxConcurrency must be a positive integer.');
    }
    return Math.min(requested, totalFrames);
  }

  return Math.min(Math.max(1, cpus().length), 4, totalFrames);
}

function isValidDimension(value: number): boolean {
  return Number.isInteger(value) && value > 0 && value <= MAX_CANVAS_DIMENSION;
}

function normalizeCanvasQuality(quality?: number): number | undefined {
  if (quality === undefined) {
    return undefined;
  }
  return Math.min(1, Math.max(0, quality / 100));
}

function getLocalP5ScriptPath(): string {
  const p5EntryPoint = require.resolve('p5');
  return join(dirname(dirname(p5EntryPoint)), 'lib', 'p5.min.js');
}

function getLocalP5Version(): string {
  const p5EntryPoint = require.resolve('p5');
  const packageJsonPath = join(dirname(dirname(p5EntryPoint)), 'package.json');
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as {
    version?: unknown;
  };
  return typeof packageJson.version === 'string'
    ? packageJson.version
    : 'unknown';
}

function validateScriptUrl(scriptUrl: string): void {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(scriptUrl);
  } catch {
    throw new Error('p5ScriptUrl must be a valid URL.');
  }

  if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') {
    throw new Error('p5ScriptUrl must use http or https.');
  }
}

function escapeInlineScript(script: string): string {
  return script.replaceAll('</script', '<\\/script');
}

function escapeHtmlAttribute(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}
