import cors from '@fastify/cors';
import Fastify from 'fastify';
import {
  P5Renderer,
  RenderConfigError,
  resolveRenderConfig,
  validateRenderOptions
} from './renderer.ts';
import {
  CAPTURE_METHODS,
  IMAGE_FORMATS,
  type RenderApiRequest,
  type RenderApiResponse,
  type RenderOptions,
  type SketchConfig
} from './types.ts';

const bodyProperties = {
  code: { type: 'string' },
  width: { type: 'number' },
  height: { type: 'number' },
  frameRate: { type: 'number' },
  durationSeconds: { type: 'number' },
  pixelDensity: { type: 'number' },
  backgroundColor: { type: 'string' },
  seed: { type: 'integer' },
  format: { type: 'string', enum: IMAGE_FORMATS },
  quality: { type: 'number' },
  captureMethod: { type: 'string', enum: CAPTURE_METHODS },
  debug: { type: 'boolean' },
  p5Version: { type: 'string' },
  p5ScriptUrl: { type: 'string' },
  timeoutMs: { type: 'number' }
} as const;

export const fastify = Fastify({ logger: process.env.NODE_ENV !== 'test' });

await fastify.register(cors, { origin: true });

fastify.post<{ Body: RenderApiRequest }>(
  '/render',
  {
    schema: {
      body: {
        type: 'object',
        // Unknown keys are reported below with a clearer message than Ajv's.
        additionalProperties: true,
        required: ['code', 'width', 'height', 'frameRate', 'durationSeconds'],
        properties: bodyProperties
      }
    }
  },
  async (request, reply) => {
    const extraKeys = Object.keys(request.body).filter(
      (key) => !Object.hasOwn(bodyProperties, key)
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
      seed,
      ...rest
    } = request.body;
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
    if (seed !== undefined) sketchConfig.seed = seed;
    const renderOptions: RenderOptions = rest;

    try {
      resolveRenderConfig(sketchConfig);
      validateRenderOptions(renderOptions);
    } catch (error) {
      if (error instanceof RenderConfigError) {
        return reply.code(400).send({ error: error.message });
      }
      throw error;
    }

    const renderer = new P5Renderer();
    try {
      await renderer.initialize();
      const result = await renderer.renderSketch(sketchConfig, renderOptions);
      const response: RenderApiResponse = {
        totalFrames: result.totalFrames,
        durationMs: result.durationMs,
        frames: result.frames.map((frame) => ({
          frameNumber: frame.frameNumber,
          timestamp: frame.timestamp,
          data: frame.buffer.toString('base64')
        }))
      };
      return reply.send(response);
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({
        error: 'Failed to render sketch',
        details: error instanceof Error ? error.message : String(error)
      });
    } finally {
      await renderer.cleanup();
    }
  }
);

fastify.get('/health', () => ({
  status: 'ok',
  timestamp: new Date().toISOString()
}));
