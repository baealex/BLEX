import type { PrismaClient } from '@prisma/client';
import type { FastifyRequest } from 'fastify';
import { readPageChrome } from '../../../platform/page-chrome.js';
import { SiteIcon } from '../../../platform/views.js';
import { SiteHeader, SiteTheme } from '../../../platform/views.js';
import { renderApplicationDocument } from '../../../platform/views.js';

const pageButton = 'rounded-full border border-line bg-surface-elevated px-8 py-3.5 font-semibold text-content transition-all duration-150 hover:-translate-y-0.5 hover:border-line-strong hover:shadow-lg';
const floatStyles = '@keyframes blex-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-20px)}}.blex-float{animation:blex-float 6s ease-in-out infinite}.blex-float-delayed{animation:blex-float 6s ease-in-out infinite 2s}@media (prefers-reduced-motion:reduce){.blex-float,.blex-float-delayed{animation:none}}';

/** Only page navigations get the 403 and 404 screens; APIs, feeds, and files keep their plain answers. */
export function wantsNotFoundPage(request: FastifyRequest): boolean {
  if (request.method !== 'GET' && request.method !== 'HEAD') return false;
  if (!String(request.headers.accept ?? '').includes('text/html')) return false;
  const path = request.url.split('?')[0];
  return !/^\/(?:v1|api|assets|resources|rss)(?:\/|$)/.test(path) && !/\.(?:md|xml|txt|json)$/i.test(path);
}

export async function renderNotFoundPage(
  db: PrismaClient, user: { id: number; username: string } | null, csrfToken: string,
): Promise<string> {
  const { brand, viewer } = await readPageChrome(db, user, csrfToken);
  return renderApplicationDocument(<html lang="ko">
    <head>
      <meta charSet="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <meta name="robots" content="noindex,nofollow" />
      <title>404 - 페이지를 찾을 수 없습니다</title>
      <link rel="icon" href={brand.faviconUrl} />
      <SiteTheme />
      <style>{floatStyles}</style>
    </head>
    <body className="bg-surface-page text-content antialiased">
      <SiteHeader brand={brand} viewer={viewer} />
      <main className="min-h-[calc(100vh-10.5rem)]">
        <div className="fixed inset-0 flex items-center justify-center overflow-hidden bg-surface-page">
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="blex-float absolute -top-[20%] -left-[10%] h-[70%] w-[70%] rounded-full bg-line/30 blur-3xl" />
            <div className="blex-float-delayed absolute top-[20%] -right-[10%] h-[60%] w-[60%] rounded-full bg-surface-subtle/60 blur-3xl" />
          </div>
          <div className="relative z-10 mx-auto max-w-2xl px-6 text-center">
            <div className="relative mb-12">
              <h1 className="select-none text-[10rem] font-bold leading-none text-content/10 sm:text-[12rem]">404</h1>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="flex size-24 rotate-12 items-center justify-center rounded-3xl bg-surface-elevated shadow-floating ring-1 ring-line/60 transition-transform duration-300 hover:rotate-0">
                  <SiteIcon name="exclamation-mark" className="text-4xl text-content" />
                </div>
              </div>
            </div>
            <h2 className="mb-6 text-3xl font-bold tracking-tight text-content sm:text-4xl">페이지를 찾을 수 없습니다</h2>
            <p className="mx-auto mb-12 max-w-md text-lg leading-relaxed text-content-secondary">요청하신 페이지가 삭제되었거나, 주소가 변경되었거나, 일시적으로 사용할 수 없는 상태입니다.</p>
            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
              <button type="button" data-history-back="" className={pageButton}>뒤로 가기</button>
              <a href="/search" className={pageButton}><SiteIcon name="search" className="mr-2 text-sm" />검색</a>
              <a href="/" className="rounded-full bg-action px-8 py-3.5 font-semibold text-content-inverted transition-all duration-150 hover:-translate-y-0.5 hover:bg-action-hover hover:shadow-lg">홈으로 돌아가기</a>
            </div>
          </div>
        </div>
      </main>
    </body>
  </html>);
}

export async function renderForbiddenPage(db: PrismaClient, user: { id: number; username: string } | null, csrfToken: string): Promise<string> {
  const { brand, viewer } = await readPageChrome(db, user, csrfToken);
  return renderApplicationDocument(<html lang="ko">
    <head>
      <meta charSet="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <meta name="robots" content="noindex,nofollow" />
      <title>403 - 접근 권한이 없습니다</title>
      <link rel="icon" href={brand.faviconUrl} />
      <SiteTheme />
      <style>{floatStyles}</style>
    </head>
    <body className="overflow-hidden bg-surface-page text-content antialiased">
      <SiteHeader brand={brand} viewer={viewer} />
      <main className="fixed inset-0 z-[1000] flex min-h-screen items-center justify-center p-4">
        <div className="absolute inset-0 bg-surface-page" />
        <div className="mx-auto max-w-4xl text-center">
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="blex-float absolute top-20 left-10 size-16 rounded-full bg-line/40" />
            <div className="blex-float-delayed absolute top-40 right-20 size-12 rounded-full bg-line-light/60" />
            <div className="blex-float absolute bottom-20 left-20 size-20 rounded-full bg-surface-subtle/70" />
            <div className="blex-float-delayed absolute right-10 bottom-40 size-14 rounded-full bg-line/30" />
          </div>
          <div className="relative z-10">
            <div className="mb-8"><h1 className="text-9xl font-bold leading-none tracking-tight text-content-hint/60 md:text-[12rem]">403</h1></div>
            <div className="mx-auto mb-8 max-w-2xl rounded-2xl bg-surface-elevated p-8 shadow-floating ring-1 ring-line/60 md:p-12">
              <h2 className="mb-4 text-3xl font-bold text-content md:text-4xl">접근 권한이 없습니다</h2>
              <p className="text-xl leading-relaxed text-content-secondary">이 페이지에 접근할 권한이 없습니다.<br />로그인 후 다시 시도해주세요.</p>
            </div>
            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
              <button type="button" data-history-back="" className="rounded-full border border-line bg-surface-elevated px-8 py-4 font-semibold text-content transition-all duration-150 hover:border-line-strong hover:bg-surface-subtle">뒤로 가기</button>
              <a href="/" className="rounded-full bg-action px-8 py-4 font-semibold text-content-inverted transition-all duration-150 hover:bg-action-hover">홈으로 이동</a>
            </div>
          </div>
        </div>
      </main>
    </body>
  </html>);
}
