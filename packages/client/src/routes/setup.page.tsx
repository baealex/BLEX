import { SiteFooter, SiteHeader, SiteTheme } from '~/appearance/shell';
import { renderApplicationDocument } from '~/application/document';
import { AuthPanel, authField, authInput, authSubmit } from '~/features/auth/ui/panel';
import type { PageProps } from '~/contracts/pages';

export default function renderPage({ error, csrf, token }: PageProps['setup']): string {
    return renderApplicationDocument(
        <html lang="ko">
            <head>
                <meta charSet="utf-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <meta name="robots" content="noindex" />
                <title>BLEX 초기 설정</title>
                <SiteTheme />
            </head>
            <body className="bg-surface-page text-content antialiased">
                <SiteHeader hideAuthLinks />
                <main className="flex min-h-[calc(100vh-10.5rem)] justify-center px-4 py-16 md:px-6">
                    <div className="w-full max-w-[420px]">
                        <AuthPanel title="첫 관리자 만들기" id="setup-title" lock>
                            {error && (
                                <p
                                    role="alert"
                                    className="mb-4 rounded-xl border border-danger-line bg-danger-surface p-3 text-sm text-danger"
                                >
                                    {error}
                                </p>
                            )}
                            <form action="/setup" method="post" className="space-y-4">
                                <input type="hidden" name="csrfmiddlewaretoken" value={csrf} />
                                {token ? (
                                    <input type="hidden" name="setupToken" value={token} />
                                ) : (
                                    <label className={authField}>
                                        설정 토큰
                                        <input
                                            className={authInput}
                                            type="password"
                                            name="setupToken"
                                            autoComplete="off"
                                            required
                                        />
                                    </label>
                                )}
                                <label className={authField}>
                                    아이디
                                    <input
                                        className={authInput}
                                        name="username"
                                        autoComplete="username"
                                        maxLength={15}
                                        required
                                    />
                                </label>
                                <label className={authField}>
                                    표시 이름
                                    <input
                                        className={authInput}
                                        name="displayName"
                                        autoComplete="name"
                                        maxLength={150}
                                        required
                                    />
                                </label>
                                <label className={authField}>
                                    이메일
                                    <input
                                        className={authInput}
                                        type="email"
                                        name="email"
                                        autoComplete="email"
                                        maxLength={254}
                                        required
                                    />
                                </label>
                                <label className={authField}>
                                    비밀번호
                                    <input
                                        className={authInput}
                                        type="password"
                                        name="password"
                                        autoComplete="new-password"
                                        required
                                    />
                                </label>
                                <label className={authField}>
                                    비밀번호 확인
                                    <input
                                        className={authInput}
                                        type="password"
                                        name="passwordCheck"
                                        autoComplete="new-password"
                                        required
                                    />
                                </label>
                                <button className={authSubmit} type="submit">
                                    관리자 만들기
                                </button>
                            </form>
                        </AuthPanel>
                    </div>
                </main>
                <SiteFooter />
            </body>
        </html>
    );
}
