export const IMAGE_FORMATS = ['png', 'jpeg'] as const;
export const CAPTURE_METHODS = ['canvas', 'screenshot'] as const;

export type ImageFormat = (typeof IMAGE_FORMATS)[number];
export type CaptureMethod = (typeof CAPTURE_METHODS)[number];

export interface SketchConfig {
  code: string;
  width: number;
  height: number;
  frameRate: number;
  durationSeconds: number;
  pixelDensity?: number;
  backgroundColor?: string;
  /** Seeds Math.random, so p5 random() and noise() repeat across renders. */
  seed?: number;
  /** Directory the sketch can load relative assets from, such as images. */
  assetDir?: string;
}

export interface RenderOptions {
  format?: ImageFormat;
  quality?: number;
  maxConcurrency?: number;
  captureMethod?: CaptureMethod;
  p5Version?: string;
  p5ScriptUrl?: string;
  p5ScriptPath?: string;
  timeoutMs?: number;
  /** Burns a HUD with frame, time and draw cost into captured frames. */
  debug?: boolean;
}

export interface RenderApiRequest
  extends Omit<SketchConfig, 'assetDir'>, Omit<RenderOptions, 'p5ScriptPath'> {}

export interface FrameData {
  frameNumber: number;
  timestamp: number;
  /** Wall-clock milliseconds the sketch's draw() took for this frame. */
  drawMs: number;
  buffer: Buffer;
}

export interface RenderResult {
  totalFrames: number;
  frames: FrameData[];
  durationMs: number;
}

export interface RenderApiResponse {
  totalFrames: number;
  durationMs: number;
  frames: ApiFrameData[];
}

export interface ApiFrameData {
  frameNumber: number;
  timestamp: number;
  data: string; // base64 encoded image data
}
