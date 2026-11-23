import type { PrismaClient } from '@prisma/client';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { readFile } from 'node:fs/promises';
import { renderToStaticMarkup } from 'react-dom/server';
import { readPageChrome } from '../../platform/page-chrome.js';
import { SiteFooter, SiteHeader, SiteTheme } from '../../platform/views.js';
import { renderApplicationDocument } from '../../platform/views.js';
import { scriptJson } from '../../platform/document.js';
import { quickstartHtml } from './quickstart-content.js';

interface DocumentationOptions {
  currentUser: (request: FastifyRequest) => Promise<{ id: number; username: string; hasEditorRole: boolean } | null>;
  siteUrl: URL;
}

const apiRoot = '/api/developer/v1';
const assetRoot = '/assets/swagger-ui';
const swaggerAssets: Record<string, string> = {
  'swagger-ui-bundle.js': 'text/javascript; charset=utf-8',
  'swagger-ui.css': 'text/css; charset=utf-8',
};
const swaggerInit = `const config = JSON.parse(document.getElementById('swagger-settings').textContent);
config.dom_id = '#swagger-ui';
config.presets = [SwaggerUIBundle.presets.apis, SwaggerUIBundle.SwaggerUIStandalonePreset];
SwaggerUIBundle(config);
`;
// The validator badge would send the schema address to an outside service.
const swaggerSettings = { layout: 'BaseLayout', deepLinking: true, url: `${apiRoot}/openapi.json`, validatorUrl: null };
const swaggerPolicy = "default-src 'none'; img-src 'self' data:; font-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'";

function csrfCookie(request: FastifyRequest): string {
  const entry = (request.headers.cookie ?? '').split(';').map((part) => part.trim()).find((part) => part.startsWith('csrftoken='));
  return entry?.slice('csrftoken='.length) ?? '';
}

export async function registerDeveloperDocumentation(app: FastifyInstance, db: PrismaClient, options: DocumentationOptions) {
  const raw = await readFile(new URL('../../../../data/developer-openapi.json', import.meta.url), 'utf8');
  const assets = new Map(await Promise.all(Object.keys(swaggerAssets).map(async (name) =>
    [name, await readFile(new URL(`../../../../data/swagger-ui/${name}`, import.meta.url))] as const)));

  const checkEditor = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = await options.currentUser(request);
    if (!user) return reply.redirect(`/login?${new URLSearchParams({ next: request.url })}`, 302);
    if (!user.hasEditorRole) return reply.redirect('/', 302);
  };
  app.get(`${apiRoot}/openapi.json`, { preHandler: checkEditor }, (_request, reply) =>
    reply.type('application/json; charset=utf-8').header('Cache-Control', 'private, no-store').send(raw));
  for (const path of ['/docs/developer-api', '/docs/developer-api/:operationId']) {
    app.get(path, { preHandler: checkEditor }, (_request, reply) => reply.redirect(`${apiRoot}/docs`, 302));
  }

  app.get<{ Params: { file: string } }>(`${assetRoot}/:file`, (request, reply) => {
    const body = assets.get(request.params.file);
    if (!body) return reply.code(404).send('Not found');
    return reply.type(swaggerAssets[request.params.file]).header('Cache-Control', 'public, max-age=86400').send(body);
  });
  app.get('/assets/blex/swagger-init.js', (_request, reply) =>
    reply.type('text/javascript; charset=utf-8').header('Cache-Control', 'public, max-age=86400').send(swaggerInit));

  app.get(`${apiRoot}/docs`, { preHandler: checkEditor }, (_request, reply) => reply
    .type('text/html; charset=utf-8')
    .header('Cache-Control', 'private, no-store')
    .header('Content-Security-Policy', swaggerPolicy)
    .send(`<!doctype html>${renderToStaticMarkup(<html lang="ko"><head>
      <meta charSet="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
      <meta name="robots" content="noindex" /><title>BLEX 개발자 API</title>
      <link rel="stylesheet" href={`${assetRoot}/swagger-ui.css`} />
    </head><body>
      <div id="swagger-ui" />
      <script type="application/json" id="swagger-settings" dangerouslySetInnerHTML={{ __html: scriptJson(swaggerSettings) }} />
      <script src={`${assetRoot}/swagger-ui-bundle.js`} />
      <script src="/assets/blex/swagger-init.js" />
    </body></html>)}`));

  app.get('/docs/developer-api/quickstart', { preHandler: checkEditor }, async (request, reply) => {
    const { brand, viewer } = await readPageChrome(db, await options.currentUser(request), csrfCookie(request));
    return reply.type('text/html; charset=utf-8').header('Cache-Control', 'private, no-store').send(renderApplicationDocument(<html lang="ko"><head>
        <meta charSet="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="noindex" /><title>{`개발자 API 빠른 시작 | ${brand.siteName}`}</title>
        <SiteTheme />
      </head><body className="bg-surface-page text-content antialiased">
        <SiteHeader brand={brand} viewer={viewer} />
        <main className="min-h-[calc(100vh-10.5rem)]" dangerouslySetInnerHTML={{ __html: quickstartHtml.replaceAll('__SITE_ORIGIN__', options.siteUrl.origin) }} />
        <SiteFooter brand={brand} />
      </body></html>));
  });
}
