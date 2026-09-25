#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { availableParallelism } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { encodeVideo } from './encode.ts';
import { P5Renderer } from './renderer.ts';
import {
  CAPTURE_METHODS,
  IMAGE_FORMATS,
  type CaptureMethod,
  type FrameData,
  type ImageFormat,
  type RenderOptions,
  type SketchConfig
} from './types.ts';

const EXAMPLES_DIR = fileURLToPath(new URL('../examples/', import.meta.url));

const USAGE = `Render p5.js sketches to video in headless Chromium.

Usage
  p5js-render <sketch> [options]    example name, .js file or http(s) URL
  p5js-render --code "<p5 code>"    inline sketch
  p5js-render --all                 every sketch in examples/

Output
  -o, --output <file>     output path; .mp4, .webm or .gif (default output/<name>.mp4)
      --out-dir <dir>     directory for default outputs (default output)
      --frames <dir>      also save each frame as an image in <dir>
      --crf <n>           video quality, lower is better (mp4 18, webm 30)

Timing
  -f, --fps <n>           frames per second (default 30)
  -d, --duration <sec>    length in seconds (default 4)
  -s, --seed <n>          seed for random() and noise() (default 1)

Canvas
  -w, --width <px>        width if the sketch has no literal createCanvas (default 800)
      --height <px>       height if the sketch has no literal createCanvas (default 600)
      --pixel-density <n> p5 pixel density (default 1)
      --background <css>  page background behind the canvas

Capture
      --debug             burn in a HUD: frame, time, draw cost, seed
      --format <fmt>      frame image format: png or jpeg (default png)
      --quality <0-100>   jpeg quality
      --capture <method>  canvas (default) or screenshot, for DOM-heavy sketches
      --timeout <ms>      how long setup() may take (default 30000)

p5 runtime (default: the installed p5 package)
      --p5-version <v>    load p5 from jsDelivr, for example 1.11.13
      --p5-url <url>      load p5 from a URL
      --p5-path <file>    load p5 from a local file

Examples
  p5js-render cube-wave --debug
  p5js-render ./sketch.js -o sketch.gif --fps 24 --duration 3
  p5js-render --all --duration 6`;

interface SketchSource {
  name: string;
  code: string;
  assetDir?: string;
}

interface CliSettings {
  config: Omit<SketchConfig, 'code' | 'assetDir'>;
  options: RenderOptions;
  outDir: string;
  output?: string;
  framesDir?: string;
  crf?: number;
}

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    help: { type: 'boolean' },
    all: { type: 'boolean' },
    code: { type: 'string' },
    output: { type: 'string', short: 'o' },
    'out-dir': { type: 'string', default: 'output' },
    frames: { type: 'string' },
    crf: { type: 'string' },
    fps: { type: 'string', short: 'f', default: '30' },
    duration: { type: 'string', short: 'd', default: '4' },
    seed: { type: 'string', short: 's', default: '1' },
    width: { type: 'string', short: 'w', default: '800' },
    height: { type: 'string', default: '600' },
    'pixel-density': { type: 'string' },
    background: { type: 'string' },
    debug: { type: 'boolean' },
    format: { type: 'string' },
    quality: { type: 'string' },
    capture: { type: 'string' },
    timeout: { type: 'string' },
    'p5-version': { type: 'string' },
    'p5-url': { type: 'string' },
    'p5-path': { type: 'string' }
  }
});

function readNumber(name: string, value: string): number;
function readNumber(
  name: string,
  value: string | undefined
): number | undefined;
function readNumber(
  name: string,
  value: string | undefined
): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  const parsed = Number(value);
  if (value.trim() === '' || !Number.isFinite(parsed)) {
    throw new Error(`--${name} must be a number, got "${value}".`);
  }
  return parsed;
}

function readChoice<T extends string>(
  name: string,
  value: string | undefined,
  choices: readonly T[]
): T | undefined {
  if (value === undefined) {
    return undefined;
  }
  const choice = choices.find((candidate) => candidate === value);
  if (!choice) {
    throw new Error(`--${name} must be one of: ${choices.join(', ')}.`);
  }
  return choice;
}

function readSettings(): CliSettings {
  const config: CliSettings['config'] = {
    width: readNumber('width', values.width),
    height: readNumber('height', values.height),
    frameRate: readNumber('fps', values.fps),
    durationSeconds: readNumber('duration', values.duration),
    seed: readNumber('seed', values.seed)
  };
  const pixelDensity = readNumber('pixel-density', values['pixel-density']);
  if (pixelDensity !== undefined) config.pixelDensity = pixelDensity;
  if (values.background !== undefined)
    config.backgroundColor = values.background;

  const options: RenderOptions = {};
  const format: ImageFormat | undefined = readChoice(
    'format',
    values.format,
    IMAGE_FORMATS
  );
  const capture: CaptureMethod | undefined = readChoice(
    'capture',
    values.capture,
    CAPTURE_METHODS
  );
  const quality = readNumber('quality', values.quality);
  const timeoutMs = readNumber('timeout', values.timeout);
  if (format !== undefined) options.format = format;
  if (capture !== undefined) options.captureMethod = capture;
  if (quality !== undefined) options.quality = quality;
  if (timeoutMs !== undefined) options.timeoutMs = timeoutMs;
  if (values.debug) options.debug = true;
  if (values['p5-version'] !== undefined)
    options.p5Version = values['p5-version'];
  if (values['p5-url'] !== undefined) options.p5ScriptUrl = values['p5-url'];
  if (values['p5-path'] !== undefined) options.p5ScriptPath = values['p5-path'];

  const settings: CliSettings = { config, options, outDir: values['out-dir'] };
  const crf = readNumber('crf', values.crf);
  if (crf !== undefined) settings.crf = crf;
  if (values.output !== undefined) settings.output = values.output;
  if (values.frames !== undefined) settings.framesDir = values.frames;
  return settings;
}

async function loadSketch(target: string): Promise<SketchSource> {
  if (/^https?:\/\//.test(target)) {
    const response = await fetch(target);
    if (!response.ok) {
      throw new Error(
        `Failed to fetch sketch: ${response.status} ${response.statusText}`
      );
    }
    const name = path.basename(new URL(target).pathname, '.js') || 'url-sketch';
    return { name, code: await response.text() };
  }

  const file = existsSync(target)
    ? target
    : path.join(EXAMPLES_DIR, `${target}.js`);
  if (!existsSync(file)) {
    throw new Error(
      `No sketch file "${target}" and no example named "${target}".`
    );
  }
  return {
    name: path.basename(file, '.js'),
    code: await readFile(file, 'utf8'),
    assetDir: path.dirname(file)
  };
}

/** Saves each frame to disk on its way to the encoder. */
async function* saveFrames(
  frames: AsyncIterable<FrameData>,
  directory: string,
  format: ImageFormat
): AsyncGenerator<FrameData> {
  await mkdir(directory, { recursive: true });
  const extension = format === 'jpeg' ? 'jpg' : 'png';
  for await (const frame of frames) {
    const name = `frame_${String(frame.frameNumber).padStart(5, '0')}.${extension}`;
    await writeFile(path.join(directory, name), frame.buffer);
    yield frame;
  }
}

/** Rewrites one terminal line with a progress bar while frames stream past. */
async function* reportProgress(
  frames: AsyncIterable<FrameData>,
  name: string,
  totalFrames: number
): AsyncGenerator<FrameData> {
  const started = performance.now();
  const width = 24;
  for await (const frame of frames) {
    const done = frame.frameNumber + 1;
    const filled = Math.round((done / totalFrames) * width);
    const fps = done / ((performance.now() - started) / 1000);
    process.stdout.write(
      `\r${name} ${'█'.repeat(filled)}${'░'.repeat(width - filled)} ${done}/${totalFrames} frames, ${fps.toFixed(0)} fps `
    );
    yield frame;
  }
  process.stdout.write('\n');
}

async function renderOne(
  renderer: P5Renderer,
  source: SketchSource,
  settings: CliSettings,
  showProgress: boolean
): Promise<string> {
  const config: SketchConfig = { ...settings.config, code: source.code };
  if (source.assetDir !== undefined) config.assetDir = source.assetDir;
  const outputPath =
    settings.output ?? path.join(settings.outDir, `${source.name}.mp4`);
  await mkdir(path.dirname(outputPath), { recursive: true });

  let frames: AsyncIterable<FrameData> = renderer.streamFrames(
    config,
    settings.options
  );
  if (settings.framesDir !== undefined) {
    const directory = values.all
      ? path.join(settings.framesDir, source.name)
      : settings.framesDir;
    frames = saveFrames(frames, directory, settings.options.format ?? 'png');
  }
  if (showProgress) {
    const totalFrames = Math.ceil(config.frameRate * config.durationSeconds);
    frames = reportProgress(frames, source.name, totalFrames);
  }

  const started = performance.now();
  const count = await encodeVideo(frames, {
    outputPath,
    frameRate: config.frameRate,
    ...(settings.crf === undefined ? {} : { crf: settings.crf })
  });
  const seconds = (performance.now() - started) / 1000;
  console.log(
    `${source.name}: ${count} frames in ${seconds.toFixed(1)}s -> ${outputPath}`
  );
  return outputPath;
}

async function renderAll(
  renderer: P5Renderer,
  settings: CliSettings
): Promise<void> {
  if (settings.output !== undefined) {
    throw new Error('--output names one file. Use --out-dir with --all.');
  }
  const names = (await readdir(EXAMPLES_DIR))
    .filter((file) => file.endsWith('.js'))
    .map((file) => file.slice(0, -3))
    .sort();

  // Each sketch renders on its own page; a few run at once to use spare cores.
  const jobs = Math.max(1, Math.min(4, Math.floor(availableParallelism() / 4)));
  const failures: string[] = [];
  const queue = [...names];
  await Promise.all(
    Array.from({ length: jobs }, async () => {
      for (let name = queue.shift(); name !== undefined; name = queue.shift()) {
        try {
          await renderOne(renderer, await loadSketch(name), settings, false);
        } catch (error) {
          failures.push(name);
          console.error(
            `${name}: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }
    })
  );

  console.log(
    `Rendered ${names.length - failures.length}/${names.length} examples.`
  );
  if (failures.length > 0) {
    console.error(`Failed: ${failures.join(', ')}`);
    process.exitCode = 1;
  }
}

async function main(): Promise<void> {
  if (
    values.help ||
    (!values.all && values.code === undefined && positionals.length === 0)
  ) {
    console.log(USAGE);
    return;
  }

  const settings = readSettings();
  const renderer = new P5Renderer();
  await renderer.initialize();
  try {
    if (values.all) {
      await renderAll(renderer, settings);
    } else {
      const source =
        values.code === undefined
          ? await loadSketch(positionals[0])
          : { name: 'inline-sketch', code: values.code };
      await renderOne(renderer, source, settings, process.stdout.isTTY);
    }
  } finally {
    await renderer.cleanup();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
