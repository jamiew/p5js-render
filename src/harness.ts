// Code in this file runs inside the browser page, not in Node.
// `installHarness` and `encodeWorker` are serialized with Function#toString,
// so they must not reference anything outside their own bodies.

export interface HarnessSettings {
  width: number;
  height: number;
  frameRate: number;
  totalFrames: number;
  seed: number;
  pixelDensity: number;
  format: 'png' | 'jpeg';
  quality: number | undefined;
  debug: boolean;
  encoderCount: number;
}

export interface BatchRequest {
  start: number;
  count: number;
  capture: boolean;
}

export interface CapturedFrame {
  frameNumber: number;
  drawMs: number;
  /** Base64 image bytes, or an empty string when capture was off. */
  data: string;
}

export interface HarnessStatus {
  ready: boolean;
  error: string | null;
}

export interface HudInfo {
  frameNumber: number;
  totalFrames: number;
  frameRate: number;
  seed: number;
  drawMs: number;
  logicalWidth: number;
}

export interface EncodeMessage {
  id: number;
  bitmap: ImageBitmap;
  type: string;
  quality: number | undefined;
  hud: HudInfo | null;
}

export type EncodeReply =
  { id: number; data: string } | { id: number; error: string };

/** The subset of a p5 instance the harness touches, across p5 1.x and 2.x. */
interface P5Instance {
  frameCount: number;
  deltaTime: number;
  drawingContext?: { canvas: HTMLCanvasElement };
  _setProperty?: (name: string, value: unknown) => void;
  createCanvas: (width: number, height: number) => unknown;
  pixelDensity: (density: number) => unknown;
  frameRate: (fps: number) => unknown;
  noLoop: () => void;
  redraw: () => unknown;
}

interface SketchTarget {
  setup?: (this: unknown) => unknown;
  draw?: (this: unknown) => unknown;
}

type P5Constructor = new (
  sketch: (instance: P5Instance & SketchTarget) => void,
  node?: unknown
) => P5Instance;

/** Read-only render facts exposed to sketches as `window.p5Render`. */
export interface RenderInfo {
  rendering: true;
  frame: number;
  totalFrames: number;
  frameRate: number;
  durationSeconds: number;
  seed: number;
  /** Runs from 0 up to (not including) 1, so loops close seamlessly. */
  progress: number;
  time: number;
  debug: boolean;
}

export interface Harness {
  patchP5(): void;
  attachGlobal(): void;
  status(): HarnessStatus;
  startEncoders(workerSource: string): void;
  renderBatch(request: BatchRequest): Promise<CapturedFrame[]>;
}

declare global {
  interface Window extends SketchTarget {
    p5?: P5Constructor & { instance?: P5Instance | null };
    p5Render?: RenderInfo;
    __p5Harness?: Harness;
  }
}

export function installHarness(settings: HarnessSettings): void {
  const win = window;

  // Seeded PRNG (sfc32 with a splitmix32 seed). p5's random() and noise()
  // fall back to Math.random(), so seeding it makes whole sketches repeatable.
  let seedState = settings.seed >>> 0;
  const splitmix = (): number => {
    seedState = (seedState + 0x9e3779b9) | 0;
    let z = seedState;
    z = Math.imul(z ^ (z >>> 16), 0x85ebca6b);
    z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35);
    return (z ^ (z >>> 16)) >>> 0;
  };
  let a = splitmix();
  let b = splitmix();
  let c = splitmix();
  let d = splitmix();
  Math.random = () => {
    const t = (((a + b) | 0) + d) | 0;
    d = (d + 1) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };

  // Virtual clock. performance.now(), Date.now() and new Date() report the
  // current frame's time, so millis() and clock-based sketches are exact.
  const realNow = performance.now.bind(performance);
  const frameMs = 1000 / settings.frameRate;
  const epochMs = Date.UTC(2025, 0, 1);
  let virtualMs = 0;
  performance.now = () => virtualMs;
  const RealDate = Date;
  function VirtualDate(...args: unknown[]): Date | string {
    const date =
      args.length === 0
        ? new RealDate(epochMs + virtualMs)
        : // Forward whatever the sketch passed to new Date(...) unchanged.
          new RealDate(...(args as ConstructorParameters<DateConstructor>));
    return new.target ? date : date.toString();
  }
  VirtualDate.prototype = RealDate.prototype;
  VirtualDate.now = () => epochMs + virtualMs;
  VirtualDate.parse = RealDate.parse;
  VirtualDate.UTC = RealDate.UTC;
  // TypeScript cannot give a plain function Date's construct signature.
  globalThis.Date = VirtualDate as unknown as DateConstructor;

  const info: RenderInfo = {
    rendering: true,
    frame: 0,
    totalFrames: settings.totalFrames,
    frameRate: settings.frameRate,
    durationSeconds: settings.totalFrames / settings.frameRate,
    seed: settings.seed,
    progress: 0,
    time: 0,
    debug: settings.debug
  };
  win.p5Render = info;

  const state: {
    instance: P5Instance | null;
    setupDone: boolean;
    autoDrawSeen: boolean;
    armed: boolean;
    error: string | null;
  } = {
    instance: null,
    setupDone: false,
    autoDrawSeen: false,
    armed: false,
    error: null
  };

  const recordError = (error: unknown): void => {
    state.error ??=
      error instanceof Error
        ? `${error.name}: ${error.message}`
        : typeof error === 'string'
          ? error
          : 'Unknown sketch error';
  };
  win.addEventListener('error', (event) =>
    recordError(event.error ?? event.message)
  );
  win.addEventListener('unhandledrejection', (event) =>
    recordError(event.reason)
  );

  const setProperty = (
    instance: P5Instance,
    name: 'frameCount' | 'deltaTime',
    value: number
  ): void => {
    // p5 1.x mirrors instance properties onto window via _setProperty.
    // p5 2.x exposes getters on window that read the instance directly.
    if (typeof instance._setProperty === 'function') {
      instance._setProperty(name, value);
    } else {
      instance[name] = value;
    }
  };

  // Wraps setup() and draw() on the global window or on an instance-mode p5
  // object. p5 calls draw() once right after setup even with noLoop(); the
  // wrapper swallows that call so stateful sketches start from a clean slate.
  const attach = (
    target: SketchTarget,
    getInstance: () => P5Instance | null | undefined
  ): void => {
    const userSetup = target.setup;
    const userDraw = target.draw;

    target.setup = async function setup(this: unknown) {
      const instance = getInstance();
      if (!instance) {
        throw new Error('p5 instance is not available during setup.');
      }
      state.instance = instance;
      instance.noLoop();
      instance.frameRate(settings.frameRate);
      instance.pixelDensity(settings.pixelDensity);
      instance.createCanvas(settings.width, settings.height);
      if (userSetup) {
        await userSetup.call(this);
      }
      state.setupDone = true;
    };

    target.draw = function draw(this: unknown) {
      if (!state.armed) {
        state.autoDrawSeen = true;
        return undefined;
      }
      return userDraw?.call(this);
    };
  };

  const encoders: Worker[] = [];
  const pending = new Map<
    number,
    { resolve: (data: string) => void; reject: (error: Error) => void }
  >();
  let nextJobId = 0;

  const encode = (
    canvas: HTMLCanvasElement,
    hud: HudInfo | null
  ): Promise<string> =>
    createImageBitmap(canvas).then((bitmap) => {
      const id = nextJobId++;
      const { promise, resolve, reject } = Promise.withResolvers<string>();
      pending.set(id, { resolve, reject });
      const message: EncodeMessage = {
        id,
        bitmap,
        type: settings.format === 'jpeg' ? 'image/jpeg' : 'image/png',
        quality: settings.quality,
        hud
      };
      encoders[id % encoders.length].postMessage(message, [bitmap]);
      return promise;
    });

  const harness: Harness = {
    // Instance mode: `new p5(sketch)` is intercepted so the sketch's own
    // setup/draw get the same wrapping as global mode.
    patchP5(): void {
      const Original = win.p5;
      if (!Original) {
        return;
      }
      const Patched = class extends Original {
        constructor(
          sketch: (instance: P5Instance & SketchTarget) => void,
          node?: unknown
        ) {
          super((instance) => {
            sketch(instance);
            attach(instance, () => instance);
          }, node);
        }
      };
      win.p5 = Patched;
    },

    attachGlobal(): void {
      if (typeof win.setup === 'function' || typeof win.draw === 'function') {
        attach(win, () => win.p5?.instance);
      }
    },

    status(): HarnessStatus {
      return {
        ready: state.setupDone && state.autoDrawSeen,
        error: state.error
      };
    },

    startEncoders(workerSource: string): void {
      const url = URL.createObjectURL(
        new Blob([workerSource], { type: 'text/javascript' })
      );
      for (let index = 0; index < settings.encoderCount; index++) {
        const worker = new Worker(url);
        worker.onmessage = (event: MessageEvent<EncodeReply>) => {
          const reply = event.data;
          const job = pending.get(reply.id);
          pending.delete(reply.id);
          if ('error' in reply) {
            job?.reject(new Error(`Frame encoding failed: ${reply.error}`));
          } else {
            job?.resolve(reply.data);
          }
        };
        encoders.push(worker);
      }
    },

    async renderBatch(request: BatchRequest): Promise<CapturedFrame[]> {
      const instance = state.instance;
      if (!instance) {
        throw new Error('Sketch is not ready.');
      }

      const results: Promise<CapturedFrame>[] = [];
      for (let offset = 0; offset < request.count; offset++) {
        const frameNumber = request.start + offset;
        virtualMs = frameNumber * frameMs;
        info.frame = frameNumber;
        info.time = virtualMs / 1000;
        info.progress = frameNumber / settings.totalFrames;
        // redraw() increments frameCount, so draw() sees frameNumber + 1,
        // matching p5's own convention that the first draw has frameCount 1.
        setProperty(instance, 'frameCount', frameNumber);
        setProperty(instance, 'deltaTime', frameMs);

        const started = realNow();
        state.armed = true;
        try {
          await instance.redraw();
        } finally {
          state.armed = false;
        }
        const drawMs = realNow() - started;

        if (state.error) {
          throw new Error(state.error);
        }

        if (!request.capture) {
          results.push(Promise.resolve({ frameNumber, drawMs, data: '' }));
          continue;
        }

        const canvas =
          instance.drawingContext?.canvas ?? document.querySelector('canvas');
        if (!canvas) {
          throw new Error('Sketch did not create a canvas.');
        }
        const hud: HudInfo | null = settings.debug
          ? {
              frameNumber,
              totalFrames: settings.totalFrames,
              frameRate: settings.frameRate,
              seed: settings.seed,
              drawMs,
              logicalWidth: settings.width
            }
          : null;
        results.push(
          encode(canvas, hud).then((data) => ({ frameNumber, drawMs, data }))
        );
      }
      return Promise.all(results);
    }
  };

  win.__p5Harness = harness;
}

/**
 * Worker body that encodes frames off the main thread, so the page can draw
 * the next frame while earlier ones compress. Draws the debug HUD when asked.
 */
export function encodeWorker(): void {
  // This runs as a worker, but the project compiles against DOM types, not WebWorker.
  const scope = self as unknown as {
    onmessage: ((event: MessageEvent<EncodeMessage>) => void) | null;
    postMessage: (message: EncodeReply) => void;
  };

  const drawHud = (
    ctx: OffscreenCanvasRenderingContext2D,
    width: number,
    height: number,
    hud: HudInfo
  ): void => {
    const scale = width / hud.logicalWidth;
    const unit =
      Math.max(1, Math.round((Math.min(width, height) / 540) * 10) / 10) *
      scale;
    const margin = 14 * unit;
    const accent = '#7CFFB2';
    const digits = String(hud.totalFrames - 1).length;
    const seconds = hud.frameNumber / hud.frameRate;

    ctx.save();
    ctx.lineWidth = 1.5 * unit;
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';

    // Viewfinder corner brackets.
    const arm = 22 * unit;
    for (const [x, y, dx, dy] of [
      [margin, margin, 1, 1],
      [width - margin, margin, -1, 1],
      [margin, height - margin, 1, -1],
      [width - margin, height - margin, -1, -1]
    ]) {
      ctx.beginPath();
      ctx.moveTo(x, y + dy * arm);
      ctx.lineTo(x, y);
      ctx.lineTo(x + dx * arm, y);
      ctx.stroke();
    }

    // Center crosshair.
    const cross = 7 * unit;
    ctx.beginPath();
    ctx.moveTo(width / 2 - cross, height / 2);
    ctx.lineTo(width / 2 + cross, height / 2);
    ctx.moveTo(width / 2, height / 2 - cross);
    ctx.lineTo(width / 2, height / 2 + cross);
    ctx.stroke();

    // Readout panel.
    const lines = [
      [
        'FRAME',
        `${String(hud.frameNumber).padStart(digits, '0')} / ${String(hud.totalFrames).padStart(digits, '0')}`
      ],
      ['TIME', `${seconds.toFixed(3)}s @ ${hud.frameRate}fps`],
      ['DRAW', `${hud.drawMs.toFixed(1)}ms`],
      ['SEED', String(hud.seed)]
    ];
    const fontSize = 11 * unit;
    const lineHeight = fontSize * 1.45;
    ctx.font = `600 ${fontSize}px ui-monospace, Menlo, Consolas, monospace`;
    ctx.textBaseline = 'middle';
    const labelWidth = ctx.measureText('FRAME  ').width;
    const valueWidth = Math.max(
      ...lines.map(([, value]) => ctx.measureText(value).width)
    );
    const panelX = margin + 10 * unit;
    const panelY = margin + 10 * unit;
    const panelW = labelWidth + valueWidth + 16 * unit;
    const panelH = lines.length * lineHeight + 10 * unit;
    ctx.fillStyle = 'rgba(8,10,14,0.72)';
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, panelH, 6 * unit);
    ctx.fill();
    lines.forEach(([label, value], index) => {
      const y = panelY + 5 * unit + lineHeight * (index + 0.5);
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.fillText(label, panelX + 8 * unit, y);
      ctx.fillStyle = accent;
      ctx.fillText(value, panelX + 8 * unit + labelWidth, y);
    });

    // Timeline with one tick per second.
    const barX = margin + 10 * unit;
    const barW = width - barX * 2;
    const barY = height - margin - 12 * unit;
    const progress = (hud.frameNumber + 1) / hud.totalFrames;
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(barX, barY, barW, 3 * unit);
    ctx.fillStyle = accent;
    ctx.fillRect(barX, barY, barW * progress, 3 * unit);
    const totalSeconds = hud.totalFrames / hud.frameRate;
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    for (let second = 0; second <= totalSeconds; second++) {
      const x = barX + (barW * second) / totalSeconds;
      ctx.fillRect(x - 0.5 * unit, barY - 4 * unit, 1 * unit, 3 * unit);
    }
    ctx.restore();
  };

  const encodeFrame = async ({
    bitmap,
    type,
    quality,
    hud
  }: EncodeMessage): Promise<string> => {
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    if (hud) {
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('OffscreenCanvas 2D context is unavailable.');
      }
      ctx.drawImage(bitmap, 0, 0);
      bitmap.close();
      drawHud(ctx, canvas.width, canvas.height, hud);
    } else {
      canvas.getContext('bitmaprenderer')?.transferFromImageBitmap(bitmap);
    }
    const blob = await canvas.convertToBlob(
      quality === undefined ? { type } : { type, quality }
    );
    return new Uint8Array(await blob.arrayBuffer()).toBase64();
  };

  scope.onmessage = (event) => {
    const { id } = event.data;
    encodeFrame(event.data).then(
      (data) => scope.postMessage({ id, data }),
      (error: unknown) =>
        scope.postMessage({
          id,
          error: error instanceof Error ? error.message : 'unknown error'
        })
    );
  };
}
