import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { navigateTo } from '../../../application/navigation.js';
import { recoveredAccountPath } from '../recovery-path.js';
import { AuthPanel } from './panel.js';
import type { LoginModel } from '../../../contracts/views';

export type { LoginModel };

interface LoginFormProps {
    model: LoginModel;
}

type LoginApiResponse = {
    status: 'DONE' | 'ERROR';
    body?: Record<string, unknown>;
    errorCode?: string;
    errorMessage?: string;
};

interface LoginError {
    message: string;
    code?: string;
}

export function LoginForm({ model }: LoginFormProps) {
    const requestController = useRef<AbortController | null>(null);
    const [username, setUsername] = useState(model.pendingOAuth?.username ?? '');
    const [password, setPassword] = useState('');
    const [code, setCode] = useState('');
    const [showCode, setShowCode] = useState(model.pendingOAuth !== null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<LoginError | null>(null);
    const [statusMessage, setStatusMessage] = useState('');
    const isOAuthChallenge = model.pendingOAuth !== null;
    const oauthUsername = model.pendingOAuth?.username ?? '';

    useEffect(
        () => () => {
            requestController.current?.abort();
            requestController.current = null;
        },
        []
    );

    async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
        event.preventDefault();
        if (isSubmitting) return;

        setIsSubmitting(true);
        setError(null);
        setStatusMessage(showCode ? '인증 코드를 확인하고 있습니다.' : '로그인 정보를 확인하고 있습니다.');
        const controller = new AbortController();
        requestController.current = controller;

        const payload = isOAuthChallenge
            ? {
                  oauth2fa: true,
                  code
              }
            : {
                  username,
                  password,
                  ...(showCode ? { code } : {})
              };

        try {
            const response = await fetch('/v1/login', {
                method: 'POST',
                credentials: 'same-origin',
                signal: controller.signal,
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': model.csrfToken
                },
                body: JSON.stringify(payload)
            });
            if (controller.signal.aborted) return;
            const result: unknown = await response.json().catch(() => null);
            if (!isLoginApiResponse(result)) {
                setError({ message: `로그인 응답을 확인할 수 없습니다. (HTTP ${response.status})` });
                setStatusMessage('');
                return;
            }
            if (result.status === 'ERROR' || !response.ok) {
                setError(toLoginError(result, response.status));
                setStatusMessage('');
                return;
            }

            if (result.body?.security === true && !isOAuthChallenge) {
                setShowCode(true);
                setCode('');
                setStatusMessage('2단계 인증을 완료해 주세요. 계정 정보는 유지됩니다.');
                return;
            }

            // Spending the recovery key turned two-factor off, so go straight to where it can be set up again.
            navigateTo(result.body?.recoveryKeyUsed === true ? recoveredAccountPath : model.next);
        } catch (cause) {
            if (controller.signal.aborted) return;
            setError({
                message:
                    cause instanceof Error
                        ? `로그인 요청에 실패했습니다: ${cause.message}`
                        : '로그인 요청에 실패했습니다. 네트워크 연결을 확인해 주세요.'
            });
            setStatusMessage('');
        } finally {
            if (!controller.signal.aborted && requestController.current === controller) {
                requestController.current = null;
                setIsSubmitting(false);
            }
        }
    }

    function handleUsernameChange(event: ChangeEvent<HTMLInputElement>): void {
        setUsername(event.currentTarget.value);
    }

    function handlePasswordChange(event: ChangeEvent<HTMLInputElement>): void {
        setPassword(event.currentTarget.value);
    }

    function handleCodeChange(event: ChangeEvent<HTMLInputElement>): void {
        setCode(event.currentTarget.value);
    }

    function handleReturnToCredentials(): void {
        setShowCode(false);
        setCode('');
        setError(null);
        setStatusMessage('');
    }

    const title = isOAuthChallenge ? '2단계 인증' : showCode ? '인증 코드 확인' : '로그인';
    const description = showCode
        ? `@${isOAuthChallenge ? oauthUsername : username} 계정의 인증 코드 또는 복구 코드를 입력해 주세요.`
        : '돌아오신 것을 환영해요';

    return (
        <main className="blex-login" lang="ko">
            <AuthPanel title={title} description={description} id="blex-login-title" lock={showCode}>
                {!showCode && model.providers.length > 0 && (
                    <>
                        <nav className="blex-login__providers" aria-label="소셜 계정으로 로그인">
                            {model.providers.map((provider) => (
                                <a
                                    className="blex-login__provider"
                                    href={`/login/start/${provider.key}?${new URLSearchParams({ next: model.next })}`}
                                    key={provider.key}
                                >
                                    {provider.name}로 계속하기
                                </a>
                            ))}
                        </nav>
                        <div className="blex-login__separator">
                            <span>또는</span>
                        </div>
                    </>
                )}
                {error && (
                    <div className="blex-login__error" role="alert">
                        <span>{error.message}</span>
                        {error.code && <small>오류 코드: {error.code}</small>}
                    </div>
                )}

                <form
                    action="/v1/login"
                    method="post"
                    className="blex-login__form"
                    onSubmit={handleSubmit}
                    aria-busy={isSubmitting}
                >
                    <input type="hidden" name="csrfmiddlewaretoken" value={model.csrfToken} />

                    {isOAuthChallenge ? (
                        <>
                            <label className="blex-login__label" htmlFor="blex-login-oauth-code">
                                인증 코드
                            </label>
                            <input
                                id="blex-login-oauth-code"
                                className="blex-login__input"
                                name="code"
                                type="text"
                                value={code}
                                onChange={handleCodeChange}
                                autoComplete="one-time-code"
                                inputMode="numeric"
                                aria-describedby="blex-login-code-help"
                                required
                                disabled={isSubmitting}
                            />
                            <p className="blex-login__hint" id="blex-login-code-help">
                                인증 앱의 코드 또는 복구 코드를 사용할 수 있습니다. 복구 코드는 한 번만 쓸 수 있고,
                                사용하면 2단계 인증이 해제됩니다.
                            </p>
                        </>
                    ) : showCode ? (
                        <>
                            <p className="blex-login__account">
                                로그인 계정 <strong>@{username}</strong>
                            </p>
                            <label className="blex-login__label" htmlFor="blex-login-code">
                                인증 코드
                            </label>
                            <input
                                id="blex-login-code"
                                className="blex-login__input"
                                name="code"
                                type="text"
                                value={code}
                                onChange={handleCodeChange}
                                autoComplete="one-time-code"
                                inputMode="numeric"
                                aria-describedby="blex-login-code-help"
                                required
                                disabled={isSubmitting}
                            />
                            <p className="blex-login__hint" id="blex-login-code-help">
                                인증 앱의 코드 또는 복구 코드를 사용할 수 있습니다. 복구 코드는 한 번만 쓸 수 있고,
                                사용하면 2단계 인증이 해제됩니다.
                            </p>
                            <button
                                className="blex-login__text-button"
                                type="button"
                                onClick={handleReturnToCredentials}
                                disabled={isSubmitting}
                            >
                                계정 정보 수정
                            </button>
                        </>
                    ) : (
                        <>
                            <label className="blex-login__label" htmlFor="blex-login-username">
                                사용자 이름
                            </label>
                            <input
                                id="blex-login-username"
                                className="blex-login__input"
                                name="username"
                                type="text"
                                value={username}
                                placeholder="사용자 이름을 입력해 주세요"
                                onChange={handleUsernameChange}
                                autoComplete="username"
                                autoCapitalize="none"
                                spellCheck={false}
                                required
                                disabled={isSubmitting}
                            />

                            <label className="blex-login__label" htmlFor="blex-login-password">
                                비밀번호
                            </label>
                            <input
                                id="blex-login-password"
                                className="blex-login__input"
                                name="password"
                                type="password"
                                value={password}
                                placeholder="비밀번호를 입력해 주세요"
                                onChange={handlePasswordChange}
                                autoComplete="current-password"
                                required
                                disabled={isSubmitting}
                            />
                        </>
                    )}

                    <button className="blex-login__submit" type="submit" disabled={isSubmitting}>
                        {isSubmitting ? '확인 중…' : isOAuthChallenge || showCode ? '인증 확인' : '로그인'}
                    </button>
                    <p className="blex-login__status" role="status" aria-live="polite">
                        {statusMessage}
                    </p>
                </form>

                {isOAuthChallenge && (
                    <a className="blex-login__restart" href="/login?restart=1">
                        다른 계정으로 로그인
                    </a>
                )}
                {!isOAuthChallenge && !showCode && (
                    <p className="mt-2 pt-8 text-center text-sm font-medium text-content-secondary">
                        계정이 없으신가요?{' '}
                        <a
                            className="ml-1 font-bold text-content hover:underline"
                            href={`/sign?${new URLSearchParams({ next: model.next })}`}
                        >
                            회원가입
                        </a>
                    </p>
                )}
            </AuthPanel>
        </main>
    );
}

function isLoginApiResponse(value: unknown): value is LoginApiResponse {
    if (!value || typeof value !== 'object') return false;
    const result = value as Record<string, unknown>;
    return (
        (result.status === 'DONE' || result.status === 'ERROR') &&
        (result.body === undefined ||
            (typeof result.body === 'object' && result.body !== null && !Array.isArray(result.body))) &&
        (result.errorCode === undefined || typeof result.errorCode === 'string') &&
        (result.errorMessage === undefined || typeof result.errorMessage === 'string')
    );
}

function toLoginError(result: LoginApiResponse, statusCode: number): LoginError {
    const code = result.errorCode;
    const knownMessages: Record<string, string> = {
        'error:AT': '사용자 이름 또는 비밀번호를 확인해 주세요.',
        'error:RJ': '요청을 확인할 수 없습니다. 인증 코드를 다시 확인해 주세요.',
        'error:VA': '인증 코드를 입력해 주세요.',
        'error:NL': '로그인이 필요합니다.'
    };
    return {
        message:
            result.errorMessage?.trim() ||
            (code
                ? (knownMessages[code] ?? `로그인에 실패했습니다. (${code})`)
                : `로그인에 실패했습니다. (HTTP ${statusCode})`),
        ...(code ? { code } : {})
    };
}
