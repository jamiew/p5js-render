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

export interface RenderResult {
  totalFrames: number;
  frames: FrameData[];
  durationMs: number;
}