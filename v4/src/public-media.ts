import fastifyStatic from '@fastify/static';
import type { FastifyInstance } from 'fastify';
import { realpath, stat } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';

const privateDirectory = '_work_logs';

function publicPath(parts: string[]): boolean {
  return parts.length > 0 && parts[0] !== privateDirectory &&
    parts.every((part) => part.length > 0 && !part.startsWith('.') && !/[\\\u0000]/.test(part));
}

export async function registerPublicMedia(app: FastifyInstance, mediaRoot: string) {
  const root = await realpath(mediaRoot);
  if (!(await stat(root)).isDirectory()) throw new Error('BLEX_V4_MEDIA_PATH must point to a directory.');

  app.register(async (media) => {
    await media.register(fastifyStatic, { root, serve: false, maxAge: '1h', immutable: false });

    media.get<{ Params: { '*': string } }>('/resources/media/*', async (request, reply) => {
      const requested = request.params['*'].split('/');
      if (!publicPath(requested)) return reply.code(404).send('Not found');

      let stored: string;
      try {
        const file = await realpath(resolve(root, ...requested));
        stored = relative(root, file);
        if (isAbsolute(stored) || !publicPath(stored.split(sep)) || !(await stat(file)).isFile()) {
          return reply.code(404).send('Not found');
        }
      } catch (error) {
        if (error instanceof Error && 'code' in error && ['ENOENT', 'ENOTDIR', 'ELOOP', 'ENAMETOOLONG'].includes(String(error.code))) {
          return reply.code(404).send('Not found');
        }
        throw error;
      }

      return reply.header('Content-Security-Policy', 'sandbox')
        .header('X-Frame-Options', 'DENY')
        .header('X-Content-Type-Options', 'nosniff')
        .sendFile(stored);
    });
  });
}
