import React, { useEffect, useState } from 'react';
import { Trans, useLingui } from '@lingui/react/macro';
import { useLoginState } from './hooks/useLoginState';
import LoginForm from './components/LoginForm';
import TwoFactorForm from './components/TwoFactorForm';
import { login } from '~/lib/api';

const Login = () => {
    const { t } = useLingui();
    const {
        state,
        updateState,
        goBackToLogin,
        checkIfBlocked,
        handleFailedLogin,
        handleFailedTwoFactor
    } = useLoginState();

    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        setIsVisible(true);
    }, []);

    const nextUrl = window.NEXT_URL || '';

    const focusNext = (index: number) => {
        if (index < 5) {
            setTimeout(() => {
                const inputs = document.querySelectorAll('input[inputmode="numeric"]');
                (inputs[index + 1] as HTMLInputElement)?.focus();
            }, 0);
        }
    };

    const focusPrev = (index: number) => {
        if (index > 0) {
            setTimeout(() => {
                const inputs = document.querySelectorAll('input[inputmode="numeric"]');
                (inputs[index - 1] as HTMLInputElement)?.focus();
            }, 0);
        }
    };

    const handlePastedCode = (pastedCode: string) => {
        const newCodes = ['', '', '', '', '', ''];
        for (let i = 0; i < Math.min(6, pastedCode.length); i++) {
            newCodes[i] = pastedCode[i];
        }
        updateState({
            codes: newCodes,
            verificationError: '',
            successMessage: ''
        });
    };

    const handleCodeInput = (index: number, value: string) => {
        const newCodes = [...state.codes];

        if (/^[0-9]$/.test(value)) {
            newCodes[index] = value;
            updateState({
                codes: newCodes,
                verificationError: '',
                successMessage: ''
            });
            focusNext(index);
        } else if (value === '') {
            newCodes[index] = '';
            updateState({ codes: newCodes });
        }
    };

    const handleCodeKeyDown = (index: number, e: React.KeyboardEvent) => {
        if (e.key === 'Backspace' && !state.codes[index] && index > 0) {
            focusPrev(index);
        } else if (e.key === 'ArrowLeft' && index > 0) {
            focusPrev(index);
        } else if (e.key === 'ArrowRight' && index < 5) {
            focusNext(index);
        }
    };

    const submitForm = async (e: React.FormEvent) => {
        e.preventDefault();

        updateState({
            usernameError: '',
            passwordError: '',
            loginError: ''
        });

        if (checkIfBlocked()) {
            return;
        }

        updateState({ isLoading: true });

        let hasError = false;
        const updates: Partial<typeof state> = {};

        if (!state.username) {
            updates.usernameError = t({
                id: 'auth.validation.username_required',
                message: 'Username is required.'
            });
            hasError = true;
        }
        if (!state.password) {
            updates.passwordError = t({
                id: 'auth.validation.password_required',
                message: 'Password is required.'
            });
            hasError = true;
        }

        if (hasError) {
            updateState({
                ...updates,
                isLoading: false
            });
            return;
        }

        try {
            const { data } = await login({
                username: state.username,
                password: state.password,
                captcha_token: state.captchaToken || undefined
            });

            if (data.status === 'DONE') {
                updateState({
                    failedAttempts: 0,
                    showCaptcha: false,
                    captchaToken: null
                });

                if (data.body?.security) {
                    updateState({ showTwoFactor: true });
                } else {
                    window.location.assign(nextUrl || '/');
                }
            } else {
                handleFailedLogin();
                updateState({
                    loginError: t({
                        id: 'auth.login.invalid_credentials',
                        message: 'The username or password is incorrect.'
                    })
                });
            }
        } catch {
            handleFailedLogin();
            updateState({
                loginError: t({
                    id: 'common.error.try_again',
                    message: 'Something went wrong. Please try again.'
                })
            });
        } finally {
            updateState({ isLoading: false });
        }
    };

    const submitTwoFactor = async (e: React.FormEvent) => {
        e.preventDefault();

        updateState({
            verificationError: '',
            successMessage: ''
        });

        if (checkIfBlocked()) {
            return;
        }

        updateState({ isTwoFactorLoading: true });

        const code = state.codes.join('');
        if (code.length !== 6 || !/^[0-9]{6}$/.test(code)) {
            updateState({
                verificationError: t({
                    id: 'auth.two_factor.invalid_format',
                    message: 'Enter a valid 6-digit code.'
                }),
                isTwoFactorLoading: false
            });
            return;
        }

        try {
            // If OAuth token exists, use it instead of username/password
            const loginData = state.oauthToken
                ? {
                    oauth_token: state.oauthToken,
                    code: code
                }
                : {
                    username: state.username,
                    password: state.password,
                    code: code,
                    captcha_token: state.captchaToken || undefined
                };

            const { data } = await login(loginData);

            if (data.status === 'DONE') {
                updateState({
                    twoFactorFailedAttempts: 0,
                    successMessage: t({
                        id: 'auth.two_factor.success_redirect',
                        message: 'Verification complete. Redirecting you to the home page.'
                    })
                });
                setTimeout(() => {
                    window.location.assign(nextUrl || '/');
                }, 1000);
            } else {
                const isBlocked = handleFailedTwoFactor();
                if (!isBlocked) {
                    updateState({
                        verificationError: t({
                            id: 'auth.two_factor.incorrect_code',
                            message: 'The verification code is incorrect.'
                        }),
                        codes: ['', '', '', '', '', '']
                    });
                    setTimeout(() => {
                        const inputs = document.querySelectorAll('input[inputmode="numeric"]');
                        (inputs[0] as HTMLInputElement)?.focus();
                    }, 0);
                }
            }
        } catch {
            handleFailedTwoFactor();
            updateState({
                verificationError: t({
                    id: 'common.error.try_again',
                    message: 'Something went wrong. Please try again.'
                })
            });
        } finally {
            updateState({ isTwoFactorLoading: false });
        }
    };

    return (
        <div className={`w-[420px] max-w-[90vw] transition-all duration-700 ease-out transform ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
            {/* Logo & Title */}
            <div className="text-center mb-8">
                <div className="mx-auto h-16 w-16 bg-action rounded-2xl flex items-center justify-center mb-6 shadow-floating ring-1 ring-line/20">
                    <svg
                        aria-hidden="true"
                        className="w-8 h-8 text-content-inverted"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24">
                        {state.showTwoFactor ? (
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        ) : (
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                        )}
                    </svg>
                </div>
                <h1 className="text-3xl font-bold text-content mb-3 tracking-tight">
                    {state.showTwoFactor ? (
                        <Trans id="auth.two_factor.title">Two-factor authentication</Trans>
                    ) : (
                        <Trans id="auth.login.title">Log in</Trans>
                    )}
                </h1>
                <p className="text-content-secondary text-sm font-medium">
                    {state.showTwoFactor ? (
                        <Trans id="auth.two_factor.description">Enter the 6-digit code from your authenticator app</Trans>
                    ) : (
                        <Trans id="auth.login.welcome_back">Welcome back</Trans>
                    )}
                </p>
            </div>

            {/* Main Login Card */}
            <div className="bg-surface/60 backdrop-blur-2xl rounded-[2rem] shadow-elevated border border-line/40 p-8 md:p-10 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-surface/40 to-transparent pointer-events-none" />
                <div className="relative z-10">
                    {!state.showTwoFactor ? (
                        <LoginForm
                            username={state.username}
                            password={state.password}
                            usernameError={state.usernameError}
                            passwordError={state.passwordError}
                            loginError={state.loginError}
                            isLoading={state.isLoading}
                            showCaptcha={state.showCaptcha}
                            onUsernameChange={(value) => updateState({ username: value })}
                            onPasswordChange={(value) => updateState({ password: value })}
                            onSubmit={submitForm}
                            onCaptchaVerify={(token) => updateState({ captchaToken: token })}
                        />
                    ) : (
                        <TwoFactorForm
                            codes={state.codes}
                            verificationError={state.verificationError}
                            successMessage={state.successMessage}
                            isTwoFactorLoading={state.isTwoFactorLoading}
                            onCodeChange={handleCodeInput}
                            onKeyDown={handleCodeKeyDown}
                            onPaste={handlePastedCode}
                            onSubmit={submitTwoFactor}
                            onGoBack={goBackToLogin}
                        />
                    )}

                    {/* Footer Links */}
                    {!state.showTwoFactor && (
                        <div className="text-center pt-8 mt-2">
                            <p className="text-sm text-content-secondary font-medium">
                                <Trans id="auth.login.no_account">Don&apos;t have an account?</Trans>
                                <a href={`/sign${nextUrl ? '?next=' + encodeURIComponent(nextUrl) : ''}`} className="font-bold text-content hover:text-content transition-colors duration-200 ml-1">
                                    <Trans id="auth.signup.title">Sign up</Trans>
                                </a>
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Login;
