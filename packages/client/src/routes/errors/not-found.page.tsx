import { SiteIcon } from '~/appearance/icons';
import { SiteHeader, SiteTheme } from '~/appearance/shell';
import { renderApplicationDocument } from '~/application/document';
import { floatStyles } from '~/features/discovery/not-found-parts';
import type { PageProps } from '~/contracts/pages';

const pageButton = 'rounded-full border border-line bg-surface-elevated px-8 py-3.5 font-semibold text-content transition-all duration-150 hover:-translate-y-0.5 hover:border-line-strong hover:shadow-lg';

export default function renderPage({ brand, viewer }: PageProps['errors/not-found']): string {
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
