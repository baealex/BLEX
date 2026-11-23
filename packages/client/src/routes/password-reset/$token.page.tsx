import { SiteFooter, SiteHeader, SiteTheme } from '~/appearance/shell';
import { renderApplicationDocument } from '~/application/document';
import type { PageProps } from '~/contracts/pages';

export default function renderPage({ brand, view, linkClass, fieldClass }: PageProps['password-reset/$token']): string {
    return renderApplicationDocument(
        <html lang="ko">
            <head>
                <meta charSet="utf-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <meta name="robots" content="noindex,nofollow,noarchive" />
                <meta name="referrer" content="no-referrer" />
                <title>{`비밀번호 재설정 - ${brand.siteName}`}</title>
                <SiteTheme />
            </head>
            <body className="bg-surface-page text-content antialiased">
                <SiteHeader brand={brand} />
                <main className="min-h-[calc(100vh-10.5rem)]">
                    <div className="mx-auto my-16 w-full max-w-md px-4">
                        <section className="rounded-2xl border border-line bg-surface p-6 shadow-subtle">
                            <h1 className="text-xl font-semibold text-content">비밀번호 재설정</h1>
                            {view.state === 'invalid' && (
                                <>
                                    <p className="mt-2 text-sm text-content-secondary">
                                        링크가 만료되었거나 이미 사용되었습니다. 사이트 관리자에게 새 링크를 요청해
                                        주세요.
                                    </p>
                                    <a className={linkClass} href="/login">
                                        로그인으로 이동
                                    </a>
                                </>
                            )}
                            {view.state === 'done' && (
                                <>
                                    <p className="mt-2 text-sm text-content-secondary" role="status">
                                        새 비밀번호를 저장했습니다. 다시 로그인해 주세요.
                                    </p>
                                    <a className={linkClass} href="/login">
                                        로그인으로 이동
                                    </a>
                                </>
                            )}
                            {view.state === 'form' && (
                                <>
                                    <p className="mt-2 text-sm text-content-secondary">{`${view.username} 계정의 새 비밀번호를 입력해 주세요. 저장하면 모든 기기에서 로그아웃됩니다.`}</p>
                                    {view.error && (
                                        <p className="mt-4 text-danger" role="alert">
                                            {view.error}
                                        </p>
                                    )}
                                    <form action={view.action} method="post" className="mt-5 space-y-4">
                                        <input type="hidden" name="csrfmiddlewaretoken" value={view.csrf} />
                                        <label className="block space-y-1">
                                            <span className="text-sm text-content">새 비밀번호</span>
                                            <input
                                                className={fieldClass}
                                                type="password"
                                                name="password"
                                                autoComplete="new-password"
                                                required
                                            />
                                        </label>
                                        <label className="block space-y-1">
                                            <span className="text-sm text-content">새 비밀번호 확인</span>
                                            <input
                                                className={fieldClass}
                                                type="password"
                                                name="passwordConfirm"
                                                autoComplete="new-password"
                                                required
                                            />
                                        </label>
                                        <button
                                            className="min-h-11 w-full rounded-lg bg-action px-4 text-content-inverted hover:bg-action-hover active:scale-95"
                                            type="submit"
                                        >
                                            저장
                                        </button>
                                    </form>
                                </>
                            )}
                        </section>
                    </div>
                </main>
                <SiteFooter brand={brand} />
            </body>
        </html>
    );
}
