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
}

export interface RenderApiRequest
  extends SketchConfig, Omit<RenderOptions, 'p5ScriptPath'> {}

export interface FrameData {
  frameNumber: number;
  timestamp: number;
  buffer: Buffer;
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

declare global {
  interface Window {
    __p5RenderFrame: (frameNumber: number) => Promise<void> | void;
    __p5RenderReady: boolean;
    p5?: typeof import('p5');
    setup?: () => void;
    draw?: () => void;
    redraw?: () => void;
  }

  var __p5RenderFrame:
    | ((frameNumber: number) => Promise<void> | void)
    | undefined;
  var __p5RenderReady: boolean;
  var redraw: (() => void) | undefined;
}

export interface RenderResult {
  totalFrames: number;
  frames: FrameData[];
  durationMs: number;
}
