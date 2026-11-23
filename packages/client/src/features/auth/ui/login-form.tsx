import { getDocumentLocale } from '../../../i18n/locale.js';
import { ui } from '../../../i18n/public-ui.js';
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
        setStatusMessage(showCode ? ui('Checking your authentication code.') : ui('Checking your sign-in details.'));
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
                setError({
                    message: ui('Could not read the sign-in response. (HTTP {value0})', { value0: response.status })
                });
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
                setStatusMessage(
                    ui('Complete two-factor authentication to continue. Your account details are preserved.')
                );
                return;
            }

            // Spending the recovery key turned two-factor off, so go straight to where it can be set up again.
            navigateTo(result.body?.recoveryKeyUsed === true ? recoveredAccountPath : model.next);
        } catch (cause) {
            if (controller.signal.aborted) return;
            setError({
                message:
                    cause instanceof Error
                        ? ui('The sign-in request failed: {value0}', { value0: cause.message })
                        : ui('The sign-in request failed. Check your network connection.')
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

    const title = isOAuthChallenge
        ? ui('Two-factor authentication')
        : showCode
          ? ui('Verify authentication code')
          : ui('Log in');
    const description = showCode
        ? ui('Enter the authentication code or recovery code for @{value0}.', {
              value0: isOAuthChallenge ? oauthUsername : username
          })
        : ui('Welcome back');

    return (
        <main className="blex-login" lang={getDocumentLocale()}>
            <AuthPanel title={title} description={description} id="blex-login-title" lock={showCode}>
                {!showCode && model.providers.length > 0 && (
                    <>
                        <nav className="blex-login__providers" aria-label={ui('Sign in with a social account')}>
                            {model.providers.map((provider) => (
                                <a
                                    className="blex-login__provider"
                                    href={`/login/start/${provider.key}?${new URLSearchParams({ next: model.next })}`}
                                    key={provider.key}
                                >
                                    {ui('Continue with {value0}', { value0: provider.name })}
                                </a>
                            ))}
                        </nav>
                        <div className="blex-login__separator">
                            <span>{ui('or')}</span>
                        </div>
                    </>
                )}
                {error && (
                    <div className="blex-login__error" role="alert">
                        <span>{error.message}</span>
                        {error.code && (
                            <small>
                                {ui('Error code:')} {error.code}
                            </small>
                        )}
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
                                {ui('Authentication code')}
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
                                {ui(
                                    'Use a code from your authenticator app or a recovery code. A recovery code works only once and disables two-factor authentication when used.'
                                )}
                            </p>
                        </>
                    ) : showCode ? (
                        <>
                            <p className="blex-login__account">
                                {ui('Account')} <strong>@{username}</strong>
                            </p>
                            <label className="blex-login__label" htmlFor="blex-login-code">
                                {ui('Authentication code')}
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
                                {ui(
                                    'Use a code from your authenticator app or a recovery code. A recovery code works only once and disables two-factor authentication when used.'
                                )}
                            </p>
                            <button
                                className="blex-login__text-button"
                                type="button"
                                onClick={handleReturnToCredentials}
                                disabled={isSubmitting}
                            >
                                {ui('Edit account details')}
                            </button>
                        </>
                    ) : (
                        <>
                            <label className="blex-login__label" htmlFor="blex-login-username">
                                {ui('Username')}
                            </label>
                            <input
                                id="blex-login-username"
                                className="blex-login__input"
                                name="username"
                                type="text"
                                value={username}
                                placeholder={ui('Enter your username')}
                                onChange={handleUsernameChange}
                                autoComplete="username"
                                autoCapitalize="none"
                                spellCheck={false}
                                required
                                disabled={isSubmitting}
                            />

                            <label className="blex-login__label" htmlFor="blex-login-password">
                                {ui('Password')}
                            </label>
                            <input
                                id="blex-login-password"
                                className="blex-login__input"
                                name="password"
                                type="password"
                                value={password}
                                placeholder={ui('Enter your password')}
                                onChange={handlePasswordChange}
                                autoComplete="current-password"
                                required
                                disabled={isSubmitting}
                            />
                        </>
                    )}

                    <button className="blex-login__submit" type="submit" disabled={isSubmitting}>
                        {isSubmitting ? ui('Checking…') : isOAuthChallenge || showCode ? ui('Verify') : ui('Log in')}
                    </button>
                    <p className="blex-login__status" role="status" aria-live="polite">
                        {statusMessage}
                    </p>
                </form>

                {isOAuthChallenge && (
                    <a className="blex-login__restart" href="/login?restart=1">
                        {ui('Sign in with a different account')}
                    </a>
                )}
                {!isOAuthChallenge && !showCode && (
                    <p className="mt-2 pt-8 text-center text-sm font-medium text-content-secondary">
                        {ui("Don't have an account?")}{' '}
                        <a
                            className="ml-1 font-bold text-content hover:underline"
                            href={`/sign?${new URLSearchParams({ next: model.next })}`}
                        >
                            {ui('Sign up')}
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
        'error:AT': ui('Check your username and password.'),
        'error:RJ': ui('Could not verify the request. Check your authentication code.'),
        'error:VA': ui('Enter your authentication code.'),
        'error:NL': ui('Sign in to continue.')
    };
    return {
        message:
            result.errorMessage?.trim() ||
            (code
                ? (knownMessages[code] ?? ui('Sign-in failed. ({value0})', { value0: code }))
                : ui('Sign-in failed. (HTTP {value0})', { value0: statusCode })),
        ...(code ? { code } : {})
    };
}
