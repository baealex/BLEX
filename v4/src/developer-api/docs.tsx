import { renderApplicationDocument } from '../application/document.js';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { readFile } from 'node:fs/promises';

interface DocumentationOptions {
  currentUser: (request: FastifyRequest) => Promise<{ hasEditorRole: boolean } | null>;
  siteUrl: URL;
}

interface ApiOperation { operationId: string; summary: string }
interface ApiContract { paths: Record<string, Record<string, ApiOperation>> }

const apiRoot = '/api/developer/v1';

export async function registerDeveloperDocumentation(app: FastifyInstance, options: DocumentationOptions) {
  const raw = await readFile(new URL('../../../data/developer-openapi.json', import.meta.url), 'utf8');
  const spec = JSON.parse(raw) as ApiContract;
  const methods = Object.entries(spec.paths).flatMap(([path, operations]) =>
    Object.entries(operations).map(([method, operation]) => ({ path, method: method.toUpperCase(), ...operation })));

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

  const docsPage = async (request: FastifyRequest, reply: FastifyReply) => {
    const quickstart = request.url.startsWith('/docs/developer-api/quickstart');
    return reply.type('text/html; charset=utf-8').header('Cache-Control', 'private, no-store').send(renderApplicationDocument(<html lang="ko"><head>
        <meta charSet="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="noindex" /><title>{quickstart ? 'Developer API 시작하기' : 'BLEX Developer API'}</title>
        <style>{'body{margin:3rem auto;max-width:54rem;padding:0 1rem;font:1rem/1.65 system-ui}pre{overflow:auto;padding:.75rem;background:color-mix(in srgb,CanvasText 8%,Canvas)}table{width:100%;border-collapse:collapse}td,th{text-align:left;padding:.5rem .75rem;border-bottom:1px solid GrayText}code{overflow-wrap:anywhere}'}</style>
      </head><body><main>
        <a href="/settings/developer-api">API 토큰 관리</a><h1>{quickstart ? 'Developer API 시작하기' : 'BLEX Developer API'}</h1>
        <p>토큰은 <code>Authorization: Bearer</code> 헤더로 보냅니다. 조회에는 <code>posts:read</code>, 작성과 발행에는 <code>posts:write</code> 권한이 필요합니다.</p>
        <pre>{`curl -H "Authorization: Bearer $BLEX_TOKEN" ${new URL(`${apiRoot}/me`, options.siteUrl).href}`}</pre>
        {!quickstart && <table>
          <thead><tr><th>메서드</th><th>경로</th><th>동작</th></tr></thead>
          <tbody>{methods.map((operation) => <tr key={operation.operationId} id={operation.operationId}>
            <td>{operation.method}</td><td><code>{operation.path}</code></td><td>{operation.summary}</td>
          </tr>)}</tbody>
        </table>}
        <p><a href={`${apiRoot}/openapi.json`}>OpenAPI 스키마</a></p>
      </main></body></html>));
  };
  app.get(`${apiRoot}/docs`, { preHandler: checkEditor }, docsPage);
  app.get('/docs/developer-api/quickstart', { preHandler: checkEditor }, docsPage);
}
