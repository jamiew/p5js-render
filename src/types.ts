export interface SketchConfig {
  code: string;
  width: number;
  height: number;
  frameRate: number;
  durationSeconds: number;
}

export interface RenderOptions {
  outputDirectory?: string;
  format?: 'png' | 'jpeg';
  quality?: number;
}

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
  data: string; // base64 encoded image data
}

declare global {
  interface Window {
    currentFrame: number;
    sketchReady: boolean;
    p5?: typeof import('p5');
    setup?: () => void;
    draw?: () => void;
    redraw?: () => void;
  }
  
  var currentFrame: number;
  var sketchReady: boolean;
  var redraw: (() => void) | undefined;
}

export interface RenderResult {
  totalFrames: number;
  frames: FrameData[];
  durationMs: number;
}