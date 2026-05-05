import Fastify from 'fastify';
import cors from '@fastify/cors';
import {
  P5Renderer,
  resolveRenderConfig,
  validateRenderOptions
} from './renderer.js';
import {
  CAPTURE_METHODS,
  IMAGE_FORMATS,
  RenderApiRequest,
  RenderOptions,
  SketchConfig
} from './types.js';

const fastify = Fastify({ logger: process.env.NODE_ENV !== 'test' });
const allowedRenderBodyKeys = new Set([
  'code',
  'width',
  'height',
  'frameRate',
  'durationSeconds',
  'pixelDensity',
  'backgroundColor',
  'format',
  'quality',
  'maxConcurrency',
  'captureMethod',
  'p5Version',
  'p5ScriptUrl',
  'timeoutMs'
]);

await fastify.register(cors, {
  origin: true
});

fastify.post<{ Body: RenderApiRequest }>(
  '/render',
  {
    schema: {
      body: {
        type: 'object',
        additionalProperties: true,
        required: ['code', 'width', 'height', 'frameRate', 'durationSeconds'],
        properties: {
          code: { type: 'string' },
          width: { type: 'number' },
          height: { type: 'number' },
          frameRate: { type: 'number' },
          durationSeconds: { type: 'number' },
          pixelDensity: { type: 'number' },
          backgroundColor: { type: 'string' },
          format: { type: 'string', enum: IMAGE_FORMATS },
          quality: { type: 'number' },
          maxConcurrency: { type: 'number' },
          captureMethod: { type: 'string', enum: CAPTURE_METHODS },
          p5Version: { type: 'string' },
          p5ScriptUrl: { type: 'string' },
          timeoutMs: { type: 'number' }
        }
      }
    }
  },
  async (request, reply) => {
    const extraKeys = Object.keys(request.body).filter(
      (key) => !allowedRenderBodyKeys.has(key)
    );
    if (extraKeys.length > 0) {
      return reply.code(400).send({
        error: `Unsupported render option: ${extraKeys.join(', ')}`
      });
    }

    const {
      code,
      width,
      height,
      frameRate,
      durationSeconds,
      pixelDensity,
      backgroundColor,
      format,
      quality,
      maxConcurrency,
      captureMethod,
      p5Version,
      p5ScriptUrl,
      timeoutMs
    } = request.body;

    if (!code || !width || !height || !frameRate || !durationSeconds) {
      return reply.code(400).send({
        error:
          'Missing required fields: code, width, height, frameRate, durationSeconds'
      });
    }

    try {
      const renderOptions: RenderOptions = {};
      if (format) renderOptions.format = format;
      if (quality !== undefined) renderOptions.quality = quality;
      if (maxConcurrency !== undefined)
        renderOptions.maxConcurrency = maxConcurrency;
      if (captureMethod) renderOptions.captureMethod = captureMethod;
      if (p5Version) renderOptions.p5Version = p5Version;
      if (p5ScriptUrl) renderOptions.p5ScriptUrl = p5ScriptUrl;
      if (timeoutMs !== undefined) renderOptions.timeoutMs = timeoutMs;
      validateRenderOptions(renderOptions);

      const sketchConfig: SketchConfig = {
        code,
        width,
        height,
        frameRate,
        durationSeconds
      };
      if (pixelDensity !== undefined) sketchConfig.pixelDensity = pixelDensity;
      if (backgroundColor !== undefined)
        sketchConfig.backgroundColor = backgroundColor;
      resolveRenderConfig(sketchConfig);

      const renderer = new P5Renderer();
      try {
        await renderer.initialize();

        const result = await renderer.renderSketch(sketchConfig, renderOptions);

        const framesData = result.frames.map((frame) => ({
          frameNumber: frame.frameNumber,
          timestamp: frame.timestamp,
          data: frame.buffer.toString('base64')
        }));

        return reply.send({
          totalFrames: result.totalFrames,
          durationMs: result.durationMs,
          frames: framesData
        });
      } finally {
        await renderer.cleanup();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      const isBadRequest =
        message.includes('must') ||
        message.includes('required') ||
        message.includes('dimensions') ||
        message.includes('too large');

      if (isBadRequest) {
        return reply.code(400).send({ error: message });
      }

      fastify.log.error(error);
      return reply.code(500).send({
        error: 'Failed to render sketch',
        details: message
      });
    }
  }
);

fastify.get('/health', () => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

export { fastify };
