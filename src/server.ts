import { fastify } from './api.ts';

const port = Number(process.env.PORT) || 3000;
const host = process.env.HOST || 'localhost';

try {
  await fastify.listen({ port, host });
} catch (error) {
  fastify.log.error(error);
  process.exit(1);
}
