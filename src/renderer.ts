import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { availableParallelism } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import { chromium, type Browser, type Page } from 'playwright';
import {
  encodeWorker,
  installHarness,
  type BatchRequest,
  type CapturedFrame,
  type HarnessSettings,
  type HarnessStatus
} from './harness.ts';
import {
  CAPTURE_METHODS,
  IMAGE_FORMATS,
  type FrameData,
  type RenderOptions,
  type RenderResult,
  type SketchConfig
} from './types.ts';

export const DEFAULT_TIMEOUT_MS = 30_000;
export const DEFAULT_PIXEL_DENSITY = 1;
export const DEFAULT_SEED = 1;
export const MAX_CANVAS_DIMENSION = 8192;
export const MAX_TOTAL_FRAMES = 60 * 60 * 10;

/** Pages load from this origin so sketches get a secure context and can fetch relative assets. */
const ORIGIN = 'http://p5js-render.localhost';
const LOCAL_P5_PATH = '/__render/p5.min.js';
const SKETCH_PATH = '/__render/sketch.js';
const FRAMES_PER_BATCH = 12;

/** Thrown for invalid input, so callers such as the HTTP API can answer 400. */
export class RenderConfigError extends Error {
  override name = 'RenderConfigError';
}

const require = createRequire(import.meta.url);
const p5CodeCache = new Map<string, string>();

export function parseCanvasDimensions(
  code: string
): { width: number; height: number } | null {
  const match = /createCanvas\s*\(\s*(\d+)\s*,\s*(\d+)/.exec(code);
  if (!match) {
    return null;
  }

  const width = Number.parseInt(match[1], 10);
  const height = Number.parseInt(match[2], 10);
  return isValidDimension(width) && isValidDimension(height)
    ? { width, height }
    : null;
}

export function resolveRenderConfig(config: SketchConfig): SketchConfig {
  const parsedDimensions = parseCanvasDimensions(config.code);
  const resolvedConfig = parsedDimensions
    ? { ...config, ...parsedDimensions }
    : config;

  validateRenderConfig(resolvedConfig);
  return resolvedConfig;
}

export function validateRenderConfig(config: SketchConfig): void {
  if (!config.code.trim()) {
    throw new RenderConfigError('Sketch code is required.');
  }

  if (!isValidDimension(config.width) || !isValidDimension(config.height)) {
    throw new RenderConfigError(
      `Canvas dimensions must be between 1 and ${MAX_CANVAS_DIMENSION} pixels.`
    );
  }

  if (
    !Number.isFinite(config.frameRate) ||
    config.frameRate <= 0 ||
    config.frameRate > 240
  ) {
    throw new RenderConfigError(
      'frameRate must be greater than 0 and no more than 240.'
    );
  }

  if (!Number.isFinite(config.durationSeconds) || config.durationSeconds <= 0) {
    throw new RenderConfigError('durationSeconds must be greater than 0.');
  }

  if (getTotalFrames(config) > MAX_TOTAL_FRAMES) {
    throw new RenderConfigError(
      `Render is too large. Limit is ${MAX_TOTAL_FRAMES} total frames.`
    );
  }

  if (
    config.pixelDensity !== undefined &&
    (!Number.isFinite(config.pixelDensity) ||
      config.pixelDensity <= 0 ||
      config.pixelDensity > 4)
  ) {
    throw new RenderConfigError(
      'pixelDensity must be greater than 0 and no more than 4.'
    );
  }

  if (config.seed !== undefined && !Number.isSafeInteger(config.seed)) {
    throw new RenderConfigError('seed must be an integer.');
  }
}

export function validateRenderOptions(options: RenderOptions): void {
  if (options.format !== undefined && !IMAGE_FORMATS.includes(options.format)) {
    throw new RenderConfigError('format must be png or jpeg.');
  }

  if (
    options.quality !== undefined &&
    (!Number.isFinite(options.quality) ||
      options.quality < 0 ||
      options.quality > 100)
  ) {
    throw new RenderConfigError('quality must be between 0 and 100.');
  }

  if (
    options.captureMethod !== undefined &&
    !CAPTURE_METHODS.includes(options.captureMethod)
  ) {
    throw new RenderConfigError('captureMethod must be canvas or screenshot.');
  }

  if (options.debug && options.captureMethod === 'screenshot') {
    throw new RenderConfigError('debug requires the canvas capture method.');
  }

  if (
    options.timeoutMs !== undefined &&
    (!Number.isFinite(options.timeoutMs) || options.timeoutMs <= 0)
  ) {
    throw new RenderConfigError('timeoutMs must be greater than 0.');
  }

  if (options.p5ScriptUrl !== undefined) {
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(options.p5ScriptUrl);
    } catch {
      throw new RenderConfigError('p5ScriptUrl must be a valid URL.');
    }
    if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') {
      throw new RenderConfigError('p5ScriptUrl must use http or https.');
    }
  }

  if (options.p5ScriptPath?.trim() === '') {
    throw new RenderConfigError('p5ScriptPath must not be empty.');
  }
}

export function getTotalFrames(config: SketchConfig): number {
  return Math.ceil(config.frameRate * config.durationSeconds);
}

/**
 * Builds the page that hosts a sketch. Script order matters: the harness
 * installs the seeded RNG and virtual clock before p5 or the sketch run.
 */
export function createSketchHTML(
  config: SketchConfig,
  options: RenderOptions = {}
): string {
  const settings: HarnessSettings = {
    width: config.width,
    height: config.height,
    frameRate: config.frameRate,
    totalFrames: getTotalFrames(config),
    seed: config.seed ?? DEFAULT_SEED,
    pixelDensity: config.pixelDensity ?? DEFAULT_PIXEL_DENSITY,
    format: options.format ?? 'png',
    quality:
      options.quality === undefined
        ? undefined
        : Math.min(1, Math.max(0, options.quality / 100)),
    debug: options.debug ?? false,
    encoderCount: Math.max(1, Math.min(4, availableParallelism() - 1))
  };
  const workerSource = `(${encodeWorker.toString()})();`;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    html, body {
      width: ${config.width}px;
      height: ${config.height}px;
      margin: 0;
      overflow: hidden;
      background: ${escapeHtml(config.backgroundColor ?? 'black')};
    }
    canvas { display: block; }
  </style>
  <script>
    (${installHarness.toString()})(${JSON.stringify(settings)});
    window.__p5Harness.startEncoders(${JSON.stringify(workerSource).replaceAll('</', '<\\/')});
  </script>
  <script src="${escapeHtml(getP5ScriptUrl(options))}"></script>
  <script>window.__p5Harness.patchP5();</script>
  <script src="${SKETCH_PATH}"></script>
  <script>window.__p5Harness.attachGlobal();</script>
</head>
<body></body>
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
        args: [
          '--disable-dev-shm-usage',
          // Lets WebGL fall back to software rendering on GPU-less CI machines.
          '--enable-unsafe-swiftshader',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding'
        ]
      });

      try {
        P5Renderer.sharedBrowser = await P5Renderer.browserLaunchPromise;
      } finally {
        P5Renderer.browserLaunchPromise = null;
      }
    }

    P5Renderer.browserRefCount++;
    this.browser = P5Renderer.sharedBrowser;
  }

  /**
   * Renders frames strictly in order on one page, yielding each as soon as it
   * is encoded. Sequential drawing keeps stateful sketches (trails, particle
   * systems, simulations) correct; a worker pool in the page compresses
   * frames in parallel, and the next batch renders while this one is consumed.
   */
  async *streamFrames(
    config: SketchConfig,
    options: RenderOptions = {}
  ): AsyncGenerator<FrameData> {
    if (!this.browser) {
      throw new Error('Renderer not initialized. Call initialize() first.');
    }

    const resolvedConfig = resolveRenderConfig(config);
    validateRenderOptions(options);

    const context = await this.browser.newContext({
      viewport: { width: resolvedConfig.width, height: resolvedConfig.height },
      // Matches devicePixelRatio to the density, so screenshot captures and
      // any DOM content render at the same resolution as the canvas.
      deviceScaleFactor: resolvedConfig.pixelDensity ?? DEFAULT_PIXEL_DENSITY
    });
    try {
      const page = await context.newPage();
      await openSketch(page, resolvedConfig, options);
      yield* prefetch(captureFrames(page, resolvedConfig, options));
    } finally {
      await context.close();
    }
  }

  async renderSketch(
    config: SketchConfig,
    options: RenderOptions = {}
  ): Promise<RenderResult> {
    const startTime = performance.now();
    const frames: FrameData[] = [];
    for await (const frame of this.streamFrames(config, options)) {
      frames.push(frame);
    }
    return {
      totalFrames: frames.length,
      frames,
      durationMs: Math.round(performance.now() - startTime)
    };
  }

  async cleanup(): Promise<void> {
    if (!this.browser) {
      return;
    }

    P5Renderer.browserRefCount--;
    this.browser = null;

    if (P5Renderer.browserRefCount <= 0 && P5Renderer.sharedBrowser) {
      const browser = P5Renderer.sharedBrowser;
      P5Renderer.sharedBrowser = null;
      P5Renderer.browserRefCount = 0;
      await browser.close();
    }
  }
}

async function openSketch(
  page: Page,
  config: SketchConfig,
  options: RenderOptions
): Promise<void> {
  const html = createSketchHTML(config, options);
  const assetRoot = config.assetDir ? resolve(config.assetDir) : null;

  await page.route(`${ORIGIN}/**`, async (route) => {
    const { pathname } = new URL(route.request().url());
    if (pathname === '/') {
      return route.fulfill({ contentType: 'text/html', body: html });
    }
    if (pathname === SKETCH_PATH) {
      return route.fulfill({
        contentType: 'text/javascript',
        body: config.code
      });
    }
    if (pathname === LOCAL_P5_PATH) {
      return route.fulfill({
        contentType: 'text/javascript',
        body: readP5Code(options.p5ScriptPath)
      });
    }
    if (assetRoot) {
      const file = resolve(assetRoot, `.${decodeURIComponent(pathname)}`);
      if (file.startsWith(assetRoot + sep) && existsSync(file)) {
        // fulfill({ path }) infers the content type from the extension.
        return route.fulfill({ path: file });
      }
    }
    return route.fulfill({ status: 404, body: 'Not found' });
  });

  await page.goto(`${ORIGIN}/`, { waitUntil: 'load' });

  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  let status: HarnessStatus | null;
  try {
    const handle = await page.waitForFunction(
      () => {
        const current = window.__p5Harness?.status();
        return current && (current.ready || current.error) ? current : null;
      },
      undefined,
      { timeout: timeoutMs, polling: 25 }
    );
    status = await handle.jsonValue();
  } catch (error) {
    if (error instanceof Error && error.name === 'TimeoutError') {
      throw new Error(
        `Sketch setup did not finish within ${timeoutMs}ms. Check for errors, missing assets or a setup() that never resolves.`,
        { cause: error }
      );
    }
    throw error;
  }

  if (status?.error) {
    throw new Error(`Sketch failed during setup: ${status.error}`);
  }
}

async function* captureFrames(
  page: Page,
  config: SketchConfig,
  options: RenderOptions
): AsyncGenerator<FrameData> {
  const totalFrames = getTotalFrames(config);
  const screenshot = options.captureMethod === 'screenshot';
  const batchSize = screenshot ? 1 : FRAMES_PER_BATCH;

  for (let start = 0; start < totalFrames; start += batchSize) {
    const request: BatchRequest = {
      start,
      count: Math.min(batchSize, totalFrames - start),
      capture: !screenshot
    };
    const captured: CapturedFrame[] = await page.evaluate((batch) => {
      if (!window.__p5Harness) {
        throw new Error('Render harness is missing from the page.');
      }
      return window.__p5Harness.renderBatch(batch);
    }, request);

    for (const frame of captured) {
      const buffer = screenshot
        ? await page.screenshot({
            type: options.format ?? 'png',
            clip: { x: 0, y: 0, width: config.width, height: config.height },
            animations: 'disabled',
            ...(options.format === 'jpeg' && options.quality !== undefined
              ? { quality: options.quality }
              : {})
          })
        : Buffer.from(frame.data, 'base64');

      yield {
        frameNumber: frame.frameNumber,
        timestamp: frame.frameNumber / config.frameRate,
        drawMs: frame.drawMs,
        buffer
      };
    }
  }
}

/**
 * Pulls from `source` in the background so the page keeps rendering while the
 * consumer (for example ffmpeg) is busy. Errors surface at the point of use.
 */
async function* prefetch<T>(source: AsyncIterable<T>): AsyncGenerator<T> {
  const queue: T[] = [];
  const state: {
    finished: boolean;
    failure: { error: unknown } | null;
    wake: (() => void) | null;
  } = { finished: false, failure: null, wake: null };

  void (async () => {
    try {
      for await (const item of source) {
        queue.push(item);
        state.wake?.();
      }
    } catch (error) {
      state.failure = { error };
    } finally {
      state.finished = true;
      state.wake?.();
    }
  })();

  while (true) {
    if (queue.length > 0) {
      // shift() drops the reference so consumed frames can be collected.
      yield queue.shift()!;
      continue;
    }
    if (state.finished) {
      if (state.failure) {
        throw state.failure.error;
      }
      return;
    }
    const { promise, resolve: resolveWake } = Promise.withResolvers<void>();
    state.wake = resolveWake;
    await promise;
    state.wake = null;
  }
}

function getP5ScriptUrl(options: RenderOptions): string {
  if (options.p5ScriptUrl) {
    return options.p5ScriptUrl;
  }
  if (options.p5Version) {
    return `https://cdn.jsdelivr.net/npm/p5@${encodeURIComponent(options.p5Version)}/lib/p5.min.js`;
  }
  return LOCAL_P5_PATH;
}

function readP5Code(scriptPath: string | undefined): string {
  const path = scriptPath
    ? resolve(scriptPath)
    : join(dirname(dirname(require.resolve('p5'))), 'lib', 'p5.min.js');
  let code = p5CodeCache.get(path);
  if (code === undefined) {
    code = readFileSync(path, 'utf8');
    p5CodeCache.set(path, code);
  }
  return code;
}

function isValidDimension(value: number): boolean {
  return Number.isInteger(value) && value > 0 && value <= MAX_CANVAS_DIMENSION;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}
