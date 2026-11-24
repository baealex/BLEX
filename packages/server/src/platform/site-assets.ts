import fastifyStatic from '@fastify/static';
import type { FastifyInstance } from 'fastify';
import { fileURLToPath } from 'node:url';
import { clientAssets, readUiAsset } from './ui-assets.js';

export function registerSiteAssets(app: FastifyInstance) {
  const root = fileURLToPath(new URL('../../../public/', import.meta.url));
  app.register(async (routes) => {
    const uiRoot = fileURLToPath(clientAssets);
    await routes.register(fastifyStatic, { root, serve: false, maxAge: '1d' });
    await routes.register(fastifyStatic, {
      root: uiRoot,
      prefix: '/assets/ui/',
      maxAge: '1y',
      immutable: true,
      decorateReply: false,
    });
    const getAppearance = () => readUiAsset('src/appearance/site-client.ts');
    routes.get('/assets/blex/theme.css', async (_request, reply) => {
      const { css } = await getAppearance();
      if (css.length !== 1) throw new Error('The BLEX site stylesheet was not built.');
      return reply
        .header('Cache-Control', 'no-cache')
        .sendFile(css[0].replace('/assets/ui/', ''), uiRoot, { cacheControl: false });
    });
    routes.get('/assets/blex/theme.js', async (_request, reply) => {
      const { script } = await getAppearance();
      return reply.header('Cache-Control', 'no-store').redirect(script, 302);
    });
    routes.get('/assets/blex/app.js', async (_request, reply) => {
      const { script } = await readUiAsset('src/application/client.tsx');
      return reply.header('Cache-Control', 'no-store').redirect(script, 302);
    });
    routes.get('/assets/blex/screen-host.js', async (_request, reply) => {
      const { script } = await readUiAsset('src/application/screen-host/client.ts');
      return reply.header('Cache-Control', 'no-store').redirect(script, 302);
    });
    // Screens used to load from /assets/web/, so only a tab opened before they joined the browser build asks
    // for it. The module starts that tab's reload for a missing catalog instead of leaving a broken screen.
    routes.get('/assets/web/*', (request, reply) => {
      if (!/\.js$/.test(request.url.split('?')[0])) return reply.callNotFound();
      return reply
        .type('text/javascript; charset=utf-8')
        .header('Cache-Control', 'no-store')
        .send(
          "document.dispatchEvent(new Event('blex:catalog-failed'));throw new Error('BLEX was updated. Reload the page.');",
        );
    });
    routes.get('/favicon.ico', (_request, reply) => reply.sendFile('favicon.ico'));
    routes.get<{ Params: { name: string } }>('/resources/:name', (request, reply) => {
      const { name } = request.params;
      if (
        !/^(?:favicon\.ico|logo[bw]\.svg|logo(?:16|32|57|72|76|96|114|120|128|144|152|192|256|512)\.png)$/.test(name)
      ) {
        return reply.code(404).send('Not found');
      }
      return reply.sendFile(name);
    });
    routes.get<{ Params: { name: string } }>('/resources/assets/images/:name', (request, reply) => {
      const { name } = request.params;
      if (!/^(?:default-(?:avatar|cover-[1-6])|ghost)\.jpg$/.test(name)) return reply.code(404).send('Not found');
      return reply.sendFile(`images/${name}`);
    });
  });
}
