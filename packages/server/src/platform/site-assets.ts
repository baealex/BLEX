import fastifyStatic from '@fastify/static';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
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
    // A classic script the head runs before the first paint, unlike the module below, which runs after it.
    routes.get('/assets/blex/theme-init.js', (_request, reply) =>
      reply.header('Cache-Control', 'no-cache').sendFile('theme-init.js', { cacheControl: false }),
    );
    routes.get('/assets/blex/theme.js', async (_request, reply) => {
      const { script } = await getAppearance();
      return reply.header('Cache-Control', 'no-store').redirect(script, 302);
    });
    routes.get('/assets/blex/app.js', async (_request, reply) => {
      const { script } = await readUiAsset('src/application/client.tsx');
      return reply.header('Cache-Control', 'no-store').redirect(script, 302);
    });
    // Only a tab opened before an update asks for these. The module sends the missing catalog event, which reloads
    // pages that listen for it; a page without that listener still shows its screen error. Screens used to load
    // from /assets/web/. A screen document names /assets/blex/screen.js for applications that mounted screens
    // in a root of their own: they import it on the way to a screen, and reload into one that renders it.
    const reloadsStaleTab = (_request: FastifyRequest, reply: FastifyReply) =>
      reply
        .type('text/javascript; charset=utf-8')
        .header('Cache-Control', 'no-store')
        .send(
          "document.dispatchEvent(new Event('blex:catalog-failed'));throw new Error('BLEX was updated. Reload the page.');",
        );
    routes.get('/assets/blex/screen.js', reloadsStaleTab);
    routes.get('/assets/web/*', (request, reply) => {
      if (!/\.js$/.test(request.url.split('?')[0])) return reply.callNotFound();
      return reloadsStaleTab(request, reply);
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
