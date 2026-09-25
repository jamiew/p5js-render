import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { extname } from 'node:path';
import type { FrameData } from './types.ts';

export const VIDEO_FORMATS = ['mp4', 'webm', 'gif'] as const;
export type VideoFormat = (typeof VIDEO_FORMATS)[number];

export interface EncodeOptions {
  outputPath: string;
  frameRate: number;
  /** Quality for mp4 (x264) and webm (VP9). Lower is better. */
  crf?: number;
}

// yuv420p needs even dimensions, so odd-sized canvases get one padded pixel.
const EVEN_PAD = 'pad=ceil(iw/2)*2:ceil(ih/2)*2';

// A keyframe every second keeps seeking (and scrubbing on the demo site) fast.
const OUTPUT_ARGS: Record<VideoFormat, (options: EncodeOptions) => string[]> = {
  mp4: ({ crf, frameRate }) => [
    '-c:v',
    'libx264',
    '-crf',
    String(crf ?? 18),
    '-preset',
    'slow',
    '-g',
    String(Math.round(frameRate)),
    '-pix_fmt',
    'yuv420p',
    '-vf',
    EVEN_PAD,
    '-movflags',
    '+faststart'
  ],
  webm: ({ crf, frameRate }) => [
    '-c:v',
    'libvpx-vp9',
    '-crf',
    String(crf ?? 30),
    '-b:v',
    '0',
    '-g',
    String(Math.round(frameRate)),
    '-row-mt',
    '1',
    '-pix_fmt',
    'yuv420p',
    '-vf',
    EVEN_PAD
  ],
  gif: () => [
    '-filter_complex',
    'split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=sierra2_4a',
    '-loop',
    '0'
  ]
};

export function videoFormatFor(outputPath: string): VideoFormat {
  const extension = extname(outputPath).slice(1).toLowerCase();
  const format = VIDEO_FORMATS.find((candidate) => candidate === extension);
  if (!format) {
    throw new Error(
      `Unsupported output extension ".${extension}". Use ${VIDEO_FORMATS.map((f) => `.${f}`).join(', ')}.`
    );
  }
  return format;
}

/**
 * Pipes encoded frames straight into ffmpeg as they arrive, so long renders
 * never hold every frame in memory. The container comes from the file extension.
 */
export async function encodeVideo(
  frames: AsyncIterable<FrameData>,
  options: EncodeOptions
): Promise<number> {
  const format = videoFormatFor(options.outputPath);
  const ffmpeg = spawn(
    'ffmpeg',
    [
      '-y',
      '-loglevel',
      'error',
      '-f',
      'image2pipe',
      '-framerate',
      String(options.frameRate),
      '-i',
      'pipe:0',
      ...OUTPUT_ARGS[format](options),
      options.outputPath
    ],
    { stdio: ['pipe', 'ignore', 'pipe'] }
  );

  const stderr: Buffer[] = [];
  ffmpeg.stderr.on('data', (chunk: Buffer) => stderr.push(chunk));
  const { promise: exit, resolve, reject } = Promise.withResolvers<void>();
  ffmpeg.on('error', (error) =>
    reject(
      new Error(
        `Could not start ffmpeg. Is it installed and on PATH? ${error.message}`
      )
    )
  );
  ffmpeg.on('close', (code) => {
    if (code === 0) {
      resolve();
    } else {
      const details = Buffer.concat(stderr).toString('utf8').trim();
      reject(new Error(details || `ffmpeg exited with code ${code}`));
    }
  });
  // Surface ffmpeg's own error rather than an unhandled EPIPE if it dies early.
  exit.catch(() => undefined);
  ffmpeg.stdin.on('error', () => undefined);

  let count = 0;
  try {
    for await (const frame of frames) {
      if (!ffmpeg.stdin.write(frame.buffer)) {
        await Promise.race([once(ffmpeg.stdin, 'drain'), exit]);
      }
      count++;
    }
  } catch (error) {
    ffmpeg.kill('SIGKILL');
    throw error;
  }
  ffmpeg.stdin.end();
  await exit;
  return count;
}
