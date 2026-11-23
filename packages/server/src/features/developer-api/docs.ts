import { renderPage } from '../../platform/views.js';
import type { PrismaClient } from '@prisma/client';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { readFile } from 'node:fs/promises';
import { readPageChrome } from '../../platform/page-chrome.js';
import { scriptJson } from '../../platform/document.js';
import { apiExamples, exampleCommand } from './examples.js';
import { developerLanguageHeaders, localizeDeveloperOpenApi, readDeveloperLocale } from './localization.js';
import type { DeveloperLocale } from './messages.js';

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
const locale = config.locale; delete config.locale;
config.requestInterceptor = (request) => { request.headers['Accept-Language'] = locale; return request; };
config.dom_id = '#swagger-ui';
config.presets = [SwaggerUIBundle.presets.apis, SwaggerUIBundle.SwaggerUIStandalonePreset];
SwaggerUIBundle(config);
`;
// The validator badge would send the schema address to an outside service.
const swaggerSettings = (locale: DeveloperLocale) => ({
  locale,
  layout: 'BaseLayout',
  deepLinking: true,
  url: `${apiRoot}/openapi.json`,
  validatorUrl: null,
  defaultModelsExpandDepth: -1,
});
const swaggerPolicy =
  "default-src 'none'; img-src 'self' data:; font-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'";

function csrfCookie(request: FastifyRequest): string {
  const entry = (request.headers.cookie ?? '')
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith('csrftoken='));
  return entry?.slice('csrftoken='.length) ?? '';
}

export async function registerDeveloperDocumentation(
  app: FastifyInstance,
  db: PrismaClient,
  options: DocumentationOptions,
) {
  const assets = new Map(
    await Promise.all(
      Object.keys(swaggerAssets).map(
        async (name) =>
          [name, await readFile(new URL(`../../../../data/swagger-ui/${name}`, import.meta.url))] as const,
      ),
    ),
  );

  const locales = new WeakMap<FastifyRequest, DeveloperLocale>();
  const checkEditor = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = await options.currentUser(request);
    if (!user) return reply.redirect(`/login?${new URLSearchParams({ next: request.url })}`, 302);
    if (!user.hasEditorRole) return reply.redirect('/', 302);
    const locale = await readDeveloperLocale(db, request, user.id);
    locales.set(request, locale);
    developerLanguageHeaders(reply, locale);
  };
  app.get(`${apiRoot}/openapi.json`, { preHandler: checkEditor }, (request, reply) =>
    reply.type('application/json; charset=utf-8').send(localizeDeveloperOpenApi(app.swagger(), locales.get(request)!)),
  );
  for (const path of ['/docs/developer-api', '/docs/developer-api/:operationId']) {
    app.get(path, { preHandler: checkEditor }, (_request, reply) => reply.redirect(`${apiRoot}/docs`, 302));
  }

  app.get<{ Params: { file: string } }>(`${assetRoot}/:file`, (request, reply) => {
    const body = assets.get(request.params.file);
    if (!body) return reply.code(404).send('Not found');
    return reply.type(swaggerAssets[request.params.file]).header('Cache-Control', 'public, max-age=86400').send(body);
  });
  app.get('/assets/blex/swagger-init.js', (_request, reply) =>
    reply.type('text/javascript; charset=utf-8').header('Cache-Control', 'public, max-age=86400').send(swaggerInit),
  );

  app.get(`${apiRoot}/docs`, { preHandler: checkEditor }, (request, reply) =>
    reply
      .type('text/html; charset=utf-8')
      .header('Cache-Control', 'private, no-store')
      .header('Content-Security-Policy', swaggerPolicy)
      .send(
        renderPage('docs/developer-api/reference', {
          assetRoot,
          locale: locales.get(request)!,
          settingsJson: scriptJson(swaggerSettings(locales.get(request)!)),
        }),
      ),
  );

  app.get('/docs/developer-api/quickstart', { preHandler: checkEditor }, async (request, reply) => {
    const { brand, viewer } = await readPageChrome(db, await options.currentUser(request), csrfCookie(request));
    const locale = locales.get(request)!;
    const commands = Object.fromEntries(
      Object.entries(apiExamples).map(([name, example]) => [name, exampleCommand(example, locale)]),
    ) as Record<keyof typeof apiExamples, string>;
    return reply
      .type('text/html; charset=utf-8')
      .header('Cache-Control', 'private, no-store')
      .send(
        renderPage('docs/developer-api/quickstart', {
          brand,
          viewer,
          locale,
          commands,
          siteOrigin: options.siteUrl.origin,
        }),
      );
  });
}
