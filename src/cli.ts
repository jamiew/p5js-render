import { spawn } from 'child_process';
import { mkdir, readdir, readFile, writeFile } from 'fs/promises';
import path from 'path';
import { P5Renderer } from './renderer.js';
import {
  CAPTURE_METHODS,
  CaptureMethod,
  FrameData,
  ImageFormat,
  IMAGE_FORMATS,
  RenderOptions,
  SketchConfig
} from './types.js';

interface RenderConfig {
  sketchName?: string;
  sketchUrl?: string;
  sketchCode?: string;
  width: number;
  height: number;
  frameRate: number;
  durationSeconds: number;
  pixelDensity?: number;
  backgroundColor?: string;
  output?: string;
  saveFrames?: boolean;
  crf: number;
}

interface CliRenderResult {
  success: boolean;
  name: string;
  time: number;
  outputPath?: string;
  error?: unknown;
}

const DEFAULT_CONFIG = {
  width: 800,
  height: 600,
  frameRate: 24,
  durationSeconds: 3,
  crf: 18
};

async function loadSketchCode(config: RenderConfig): Promise<string> {
  if (config.sketchCode) {
    return config.sketchCode;
  }

  if (config.sketchUrl) {
    const response = await fetch(config.sketchUrl);
    if (!response.ok) {
      throw new Error(
        `Failed to fetch sketch: ${response.status} ${response.statusText}`
      );
    }
    return await response.text();
  }

  if (config.sketchName) {
    return await readFile(
      path.join('examples', `${config.sketchName}.js`),
      'utf8'
    );
  }

  throw new Error('Must provide sketchName, sketchUrl, or sketchCode.');
}

async function renderSketch(
  config: RenderConfig,
  options: RenderOptions
): Promise<CliRenderResult> {
  const outputName = config.sketchName || 'custom-sketch';
  const outputPath = config.output ?? path.join('output', `${outputName}.mp4`);
  const frameDir = path.join('output', outputName);
  const startTime = Date.now();

  console.log(
    `Rendering ${outputName} at ${config.width}x${config.height}, ${config.frameRate} fps.`
  );

  const renderer = new P5Renderer();
  try {
    const code = await loadSketchCode(config);
    const sketchConfig: SketchConfig = {
      code,
      width: config.width,
      height: config.height,
      frameRate: config.frameRate,
      durationSeconds: config.durationSeconds
    };
    if (config.pixelDensity !== undefined)
      sketchConfig.pixelDensity = config.pixelDensity;
    if (config.backgroundColor !== undefined)
      sketchConfig.backgroundColor = config.backgroundColor;

    await renderer.initialize();
    const result = await renderer.renderSketch(sketchConfig, options);

    if (config.saveFrames) {
      await saveFrames(result.frames, frameDir, options.format ?? 'png');
      console.log(`Saved ${result.frames.length} frames to ${frameDir}.`);
    }

    await mkdir(path.dirname(outputPath), { recursive: true });
    await encodeFramesWithFfmpeg(result.frames, {
      frameRate: config.frameRate,
      outputPath,
      crf: config.crf
    });

    const time = Date.now() - startTime;
    console.log(
      `Rendered ${result.totalFrames} frames in ${formatTime(time)}.`
    );
    console.log(`Video written to ${outputPath}.`);
    return { success: true, name: outputName, time, outputPath };
  } catch (error) {
    const time = Date.now() - startTime;
    console.error(
      `Render failed for ${outputName}: ${error instanceof Error ? error.message : String(error)}`
    );
    return { success: false, name: outputName, time, error };
  } finally {
    await renderer.cleanup();
  }
}

async function saveFrames(
  frames: FrameData[],
  outputDir: string,
  extension: ImageFormat
): Promise<void> {
  await mkdir(outputDir, { recursive: true });
  await Promise.all(
    frames.map(async (frame) => {
      const frameNumber = String(frame.frameNumber).padStart(6, '0');
      const filename = path.join(
        outputDir,
        `frame_${frameNumber}.${extension === 'jpeg' ? 'jpg' : 'png'}`
      );
      await writeFile(filename, frame.buffer);
    })
  );
}

async function encodeFramesWithFfmpeg(
  frames: FrameData[],
  config: { frameRate: number; outputPath: string; crf: number }
): Promise<void> {
  const args = [
    '-y',
    '-f',
    'image2pipe',
    '-framerate',
    String(config.frameRate),
    '-i',
    'pipe:0',
    '-c:v',
    'libx264',
    '-crf',
    String(config.crf),
    '-pix_fmt',
    'yuv420p',
    config.outputPath
  ];

  const ffmpeg = spawn('ffmpeg', args, { stdio: ['pipe', 'pipe', 'pipe'] });
  const stderr: Buffer[] = [];

  ffmpeg.stderr.on('data', (chunk: Buffer) => {
    stderr.push(chunk);
  });

  const completion = new Promise<void>(
    (resolveCompletion, rejectCompletion) => {
      ffmpeg.on('error', rejectCompletion);
      ffmpeg.on('close', (code) => {
        if (code === 0) {
          resolveCompletion();
        } else {
          rejectCompletion(
            new Error(
              Buffer.concat(stderr).toString('utf8') ||
                `ffmpeg exited with code ${code}`
            )
          );
        }
      });
    }
  );

  for (const frame of frames) {
    if (!ffmpeg.stdin.write(frame.buffer)) {
      await new Promise<void>((resolveDrain) =>
        ffmpeg.stdin.once('drain', resolveDrain)
      );
    }
  }
  ffmpeg.stdin.end();

  await completion;
}

async function renderAllExamples(options: RenderOptions): Promise<void> {
  const files = (await readdir('examples'))
    .filter((file) => file.endsWith('.js'))
    .sort();
  const results: CliRenderResult[] = [];
  const startTime = Date.now();

  for (const file of files) {
    const sketchName = file.replace(/\.js$/, '');
    results.push(
      await renderSketch(
        {
          ...DEFAULT_CONFIG,
          ...readConfigFromEnv(),
          sketchName
        },
        options
      )
    );
  }

  const successful = results.filter((result) => result.success);
  const failed = results.filter((result) => !result.success);
  console.log(
    `Finished ${successful.length}/${results.length} renders in ${formatTime(Date.now() - startTime)}.`
  );

  if (failed.length > 0) {
    console.log(`Failed: ${failed.map((result) => result.name).join(', ')}`);
    process.exitCode = 1;
  }
}

function readConfigFromEnv(): Partial<RenderConfig> {
  const config: Partial<RenderConfig> = {};
  const width = readNumberEnv('WIDTH');
  const height = readNumberEnv('HEIGHT');
  const frameRate = readNumberEnv('FRAMERATE');
  const durationSeconds = readNumberEnv('DURATION');
  const pixelDensity = readNumberEnv('PIXEL_DENSITY');
  const crf = readNumberEnv('CRF');

  if (width !== undefined) config.width = width;
  if (height !== undefined) config.height = height;
  if (frameRate !== undefined) config.frameRate = frameRate;
  if (durationSeconds !== undefined) config.durationSeconds = durationSeconds;
  if (pixelDensity !== undefined) config.pixelDensity = pixelDensity;
  if (crf !== undefined) config.crf = crf;

  if (process.env.BACKGROUND_COLOR !== undefined)
    config.backgroundColor = process.env.BACKGROUND_COLOR;
  if (process.env.OUTPUT !== undefined) config.output = process.env.OUTPUT;
  if (process.env.SAVE_FRAMES !== undefined) {
    config.saveFrames =
      process.env.SAVE_FRAMES === '1' || process.env.SAVE_FRAMES === 'true';
  }

  return config;
}

function readOptionsFromEnv(): RenderOptions {
  const options: RenderOptions = {};
  const format = readImageFormatEnv();
  const captureMethod = readCaptureMethodEnv();
  const quality = readNumberEnv('QUALITY');
  const maxConcurrency = readNumberEnv('MAX_CONCURRENCY');
  const timeoutMs = readNumberEnv('TIMEOUT_MS');

  if (format !== undefined) options.format = format;
  if (captureMethod !== undefined) options.captureMethod = captureMethod;
  if (process.env.P5_VERSION !== undefined)
    options.p5Version = process.env.P5_VERSION;
  if (process.env.P5_SCRIPT_URL !== undefined)
    options.p5ScriptUrl = process.env.P5_SCRIPT_URL;
  if (process.env.P5_SCRIPT_PATH !== undefined)
    options.p5ScriptPath = process.env.P5_SCRIPT_PATH;
  if (quality !== undefined) options.quality = quality;
  if (maxConcurrency !== undefined) options.maxConcurrency = maxConcurrency;
  if (timeoutMs !== undefined) options.timeoutMs = timeoutMs;

  return options;
}

function readNumberEnv(name: string): number | undefined {
  const value = process.env[name];
  if (value === undefined || value === '') {
    return undefined;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${name} must be a number.`);
  }
  return parsed;
}

function readImageFormatEnv(): ImageFormat | undefined {
  if (process.env.FORMAT === undefined) {
    return undefined;
  }
  if (isImageFormat(process.env.FORMAT)) {
    return process.env.FORMAT;
  }
  throw new Error('FORMAT must be png or jpeg.');
}

function readCaptureMethodEnv(): CaptureMethod | undefined {
  if (process.env.CAPTURE_METHOD === undefined) {
    return undefined;
  }
  if (isCaptureMethod(process.env.CAPTURE_METHOD)) {
    return process.env.CAPTURE_METHOD;
  }
  throw new Error('CAPTURE_METHOD must be canvas or screenshot.');
}

function isImageFormat(value: string): value is ImageFormat {
  return IMAGE_FORMATS.includes(value as ImageFormat);
}

function isCaptureMethod(value: string): value is CaptureMethod {
  return CAPTURE_METHODS.includes(value as CaptureMethod);
}

function formatTime(ms: number): string {
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

function printUsage(): void {
  console.log(`
Usage:
  npm run render <sketch-name>
  npm run render:url <url>
  npm run render:code "<p5js-code>"
  npm run render:all

Environment options:
  WIDTH=1920 HEIGHT=1080 FRAMERATE=60 DURATION=5 npm run render rotating-cubes
  P5_VERSION=1.11.13 npm run render simple-circle
  P5_SCRIPT_PATH=./vendor/p5.min.js npm run render simple-circle
  CAPTURE_METHOD=screenshot MAX_CONCURRENCY=2 SAVE_FRAMES=1 npm run render simple-circle
  OUTPUT=output/custom.mp4 CRF=16 npm run render simple-circle
`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    printUsage();
    return;
  }

  const command = args[0];
  const options = readOptionsFromEnv();

  if (command === 'all') {
    await renderAllExamples(options);
    return;
  }

  const config: RenderConfig = {
    ...DEFAULT_CONFIG,
    ...readConfigFromEnv()
  };

  if (command === 'url') {
    if (!args[1]) {
      throw new Error('render:url requires a URL argument.');
    }
    config.sketchUrl = args[1];
    config.sketchName = 'url-sketch';
  } else if (command === 'code') {
    if (!args[1]) {
      throw new Error('render:code requires a p5.js code argument.');
    }
    config.sketchCode = args[1];
    config.sketchName = 'inline-sketch';
  } else {
    config.sketchName = command;
  }

  const result = await renderSketch(config, options);
  if (!result.success) {
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}

export { renderSketch, renderAllExamples, encodeFramesWithFfmpeg };
