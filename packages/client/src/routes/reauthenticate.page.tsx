import { SiteFooter, SiteHeader, SiteTheme } from '~/appearance/shell';
import { renderApplicationDocument } from '~/application/document';
import type { PageProps } from '~/contracts/pages';

function reauthenticationPath(next: string) {
  return `/reauthenticate?${new URLSearchParams({ next })}`;
}

export default function renderPage({
 brand, account, viewer, csrf, error, showForm, next, pendingFactor, fieldClass, visibleProviders
}: PageProps['reauthenticate']): string {
  return renderApplicationDocument(<html lang="ko">
      <head>
          <meta charSet="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <meta name="robots" content="noindex,nofollow,noarchive" />
          <title>{`본인 확인 - ${brand.siteName}`}</title>
          <SiteTheme />
      </head>
      <body className="bg-surface-page text-content antialiased">
          <SiteHeader
              brand={brand}
              viewer={{
 username: account.username,
hasEditorRole: viewer?.role === 'EDITOR',
isStaff: Boolean(viewer?.isStaff),
unreadCount: Number(viewer?.unreadCount ?? 0),
csrfToken: csrf
}}
          />
          <main className="min-h-[calc(100vh-10.5rem)]"><div className="mx-auto my-16 w-full max-w-md px-4">
              <section className="rounded-2xl border border-line bg-surface p-6 shadow-subtle">
                  <h1 className="text-xl font-semibold text-content">본인 확인</h1>
                  <p className="mt-2 text-sm text-content-secondary">본인 확인을 마치면 설정으로 돌아가 변경을 다시 시도할 수 있습니다.</p>
                  {error && <p className="mt-4 text-danger" role="alert">{error}</p>}
                  {showForm && <form action={reauthenticationPath(next)} method="post" className="mt-5 space-y-4">
                      <input type="hidden" name="csrfmiddlewaretoken" value={csrf} />
                      {!pendingFactor && <label className="block space-y-1"><span className="text-sm text-content">현재 비밀번호</span>
                          <input
                              className={fieldClass}
                              type="password"
                              name="password"
                              autoComplete="current-password"
                              required
                          /></label>}
                      {account.factorId !== null && <label className="block space-y-1"><span className="text-sm text-content">인증 앱 코드 또는 복구 키</span>
                          <input
                              className={fieldClass}
                              name="code"
                              autoComplete="one-time-code"
                              maxLength={64}
                              required
                          /></label>}
                      <button className="min-h-11 w-full rounded-lg bg-action px-4 text-content-inverted hover:bg-action-hover active:scale-95" type="submit">확인</button>
                  </form>}
                  {visibleProviders.length > 0 ? <div className="mt-5 space-y-3">{visibleProviders.map((provider) => <form
                      key={provider.key}
                      action={`/login/start/${provider.key}?${new URLSearchParams({ next })}`}
                      method="post">
                      <input type="hidden" name="csrfmiddlewaretoken" value={csrf} />
                      <button className="min-h-11 w-full rounded-lg border border-line px-4 hover:bg-surface-subtle active:scale-95" type="submit">{`${provider.name}로 계속하기`}</button>
                  </form>)}</div> : !showForm && <p className="mt-4 text-sm text-content-secondary">계정 접근을 복구하려면 사이트 관리자에게 문의하세요.</p>}
                  <a className="mt-4 inline-flex min-h-11 items-center text-sm text-content-secondary hover:underline" href={next}>취소</a>
              </section>
          </div></main>
          <SiteFooter brand={brand} />
      </body>
  </html>);
}
