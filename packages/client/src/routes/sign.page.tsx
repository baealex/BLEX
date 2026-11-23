import { SiteFooter, SiteHeader, SiteTheme } from '~/appearance/shell';
import { renderApplicationDocument } from '~/application/document';
import { AuthPanel, authField, authInput, authSubmit } from '~/features/auth/ui/panel';
import type { PageProps } from '~/contracts/pages';

export default function renderPage({ brand, siteKey, social, params, error, csrf, invite }: PageProps['sign']): string {
    return renderApplicationDocument(
        <html lang="ko">
            <head>
                <meta charSet="utf-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <meta name="robots" content="noindex" />
                <title>{`회원가입 - ${brand.siteName}`}</title>
                <SiteTheme />
                {siteKey && (
                    <script src="https://js.hcaptcha.com/1/api.js" async defer data-blex-trusted-script="hcaptcha" />
                )}
            </head>
            <body className="bg-surface-page text-content antialiased">
                <SiteHeader brand={brand} />
                <main className="flex min-h-[calc(100vh-10.5rem)] justify-center px-4 py-16 md:px-6">
                    <div className="w-full max-w-[420px]">
                        <AuthPanel
                            title="회원가입"
                            description={`${brand.siteName}에서 새 계정을 만드세요`}
                            id="signup-title"
                        >
                            {social.length > 0 && (
                                <div className="mb-6 grid gap-2">
                                    {social.map((name) => (
                                        <a
                                            key={name}
                                            className="rounded-lg border border-line py-3 text-center text-sm font-semibold hover:bg-surface-subtle"
                                            href={`/login/start/${name.toLowerCase()}${params ? `?${params}` : ''}`}
                                        >
                                            {name} 계정으로 계속
                                        </a>
                                    ))}
                                    <p className="text-center text-xs text-content-hint">또는</p>
                                </div>
                            )}
                            {error && (
                                <p
                                    role="alert"
                                    className="mb-4 rounded-xl border border-danger-line bg-danger-surface p-3 text-sm text-danger"
                                >
                                    {error}
                                </p>
                            )}
                            <form action={params ? `/sign?${params}` : '/sign'} method="post" className="space-y-4">
                                <input type="hidden" name="csrfmiddlewaretoken" value={csrf} />
                                <label className={authField}>
                                    아이디
                                    <input
                                        className={authInput}
                                        name="username"
                                        autoComplete="username"
                                        placeholder="아이디를 입력하세요"
                                        pattern="[a-z0-9]{4,15}"
                                        required
                                    />
                                </label>
                                <label className={authField}>
                                    표시 이름
                                    <input
                                        className={authInput}
                                        name="name"
                                        autoComplete="name"
                                        placeholder="표시 이름을 입력하세요"
                                        maxLength={150}
                                        required
                                    />
                                </label>
                                <label className={authField}>
                                    이메일
                                    <input
                                        className={authInput}
                                        name="email"
                                        type="email"
                                        autoComplete="email"
                                        placeholder="이메일을 입력하세요"
                                        maxLength={254}
                                        required
                                    />
                                </label>
                                <label className={authField}>
                                    비밀번호
                                    <input
                                        className={authInput}
                                        name="password"
                                        type="password"
                                        placeholder="비밀번호를 입력하세요"
                                        minLength={8}
                                        autoComplete="new-password"
                                        required
                                    />
                                </label>
                                <label className={authField}>
                                    비밀번호 확인
                                    <input
                                        className={authInput}
                                        name="passwordCheck"
                                        type="password"
                                        placeholder="비밀번호를 한 번 더 입력하세요"
                                        minLength={8}
                                        autoComplete="new-password"
                                        required
                                    />
                                </label>
                                <details open={Boolean(invite)}>
                                    <summary className="cursor-pointer text-xs font-semibold text-content-secondary">
                                        초대 코드
                                    </summary>
                                    <input
                                        className={authInput}
                                        name="inviteCode"
                                        aria-label="초대 코드"
                                        defaultValue={invite}
                                        maxLength={64}
                                    />
                                </details>
                                {siteKey && (
                                    <div className="h-captcha" data-sitekey={siteKey} data-blex-hcaptcha-widget="" />
                                )}
                                <button className={authSubmit} type="submit">
                                    가입하기
                                </button>
                            </form>
                            <p className="mt-6 border-t border-line-light pt-6 text-center text-sm font-medium text-content-secondary">
                                이미 계정이 있나요?{' '}
                                <a
                                    href={params ? `/login?${params}` : '/login'}
                                    className="ml-1 font-bold text-content underline"
                                >
                                    로그인
                                </a>
                            </p>
                        </AuthPanel>
                    </div>
                </main>
                <SiteFooter brand={brand} />
            </body>
        </html>
    );
}
