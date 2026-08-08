import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Trans, useLingui } from '@lingui/react/macro';
import SocialLogin from '~/components/remotes/SocialLogin';
import { useResolvedTheme } from '~/hooks/useResolvedTheme';

declare global {
    interface Window {
        hcaptcha?: {
            render: (container: string | HTMLElement, params: unknown) => string;
            reset: (widgetId?: string) => void;
            remove: (widgetId?: string) => void;
        };
        HCAPTCHA_SITE_KEY?: string;
        NEXT_URL: string;
        INVITE_CODE?: string;
    }
}

const getCsrfToken = (): string => {
    const token = document.querySelector<HTMLInputElement>('[name=csrfmiddlewaretoken]')?.value;
    return token || '';
};

interface PasswordStrength {
    level: 'too_short' | 'weak' | 'fair' | 'strong';
    color: string;
}

const getPasswordStrength = (pw: string): PasswordStrength | null => {
    if (!pw) return null;
    if (pw.length < 8) {
        return {
            level: 'too_short',
            color: 'text-danger'
        };
    }
    let score = 0;
    if (pw.length >= 8) score++;
    if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
    if (/\d/.test(pw)) score++;
    if (/[^a-zA-Z0-9]/.test(pw)) score++;
    if (score <= 1) {
        return {
            level: 'weak',
            color: 'text-warning'
        };
    }
    if (score <= 2) {
        return {
            level: 'fair',
            color: 'text-warning'
        };
    }
    return {
        level: 'strong',
        color: 'text-success'
    };
};

const Signup = () => {
    const { t } = useLingui();
    const [username, setUsername] = useState('');
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [usernameError, setUsernameError] = useState('');
    const [nameError, setNameError] = useState('');
    const [emailError, setEmailError] = useState('');
    const [passwordError, setPasswordError] = useState('');
    const [confirmPasswordError, setConfirmPasswordError] = useState('');
    const [signupError, setSignupError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [captchaToken, setCaptchaToken] = useState('');
    const [isVisible, setIsVisible] = useState(false);
    const resolvedTheme = useResolvedTheme();

    const passwordStrength = getPasswordStrength(password);
    const passwordStrengthLabel = passwordStrength
        ? {
            too_short: t({
                id: 'auth.signup.password_strength.too_short',
                message: 'Too short'
            }),
            weak: t({
                id: 'auth.signup.password_strength.weak',
                message: 'Weak'
            }),
            fair: t({
                id: 'auth.signup.password_strength.fair',
                message: 'Fair'
            }),
            strong: t({
                id: 'auth.signup.password_strength.strong',
                message: 'Strong'
            })
        }[passwordStrength.level]
        : '';

    const captchaRef = useRef<HTMLDivElement>(null);
    const widgetIdRef = useRef<string | null>(null);

    const renderCaptcha = useCallback(() => {
        if (!captchaRef.current || !window.hcaptcha || !window.HCAPTCHA_SITE_KEY) {
            return;
        }

        if (widgetIdRef.current) {
            try {
                window.hcaptcha.remove(widgetIdRef.current);
            } catch {
                // Ignore error
            }
            widgetIdRef.current = null;
        }

        try {
            setCaptchaToken('');
            widgetIdRef.current = window.hcaptcha.render(captchaRef.current, {
                sitekey: window.HCAPTCHA_SITE_KEY,
                theme: resolvedTheme,
                size: 'normal',
                callback: (token: string) => {
                    setCaptchaToken(token);
                }
            });
        } catch {
            // Ignore error
        }
    }, [resolvedTheme]);

    useEffect(() => {
        setIsVisible(true);
        if (window.HCAPTCHA_SITE_KEY && window.hcaptcha) {
            renderCaptcha();
        } else if (window.HCAPTCHA_SITE_KEY) {
            const checkHCaptcha = setInterval(() => {
                if (window.hcaptcha) {
                    clearInterval(checkHCaptcha);
                    renderCaptcha();
                }
            }, 100);
            return () => clearInterval(checkHCaptcha);
        }
    }, [renderCaptcha]);

    useEffect(() => {
        return () => {
            if (widgetIdRef.current && window.hcaptcha) {
                try {
                    window.hcaptcha.remove(widgetIdRef.current);
                } catch {
                    // Ignore error
                }
            }
        };
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        setUsernameError('');
        setNameError('');
        setEmailError('');
        setPasswordError('');
        setConfirmPasswordError('');
        setSignupError('');

        let hasError = false;
        if (!username.trim()) {
            setUsernameError(t({
                id: 'auth.validation.username_required',
                message: 'Username is required.'
            }));
            hasError = true;
        } else if (!/^[a-z0-9]+$/.test(username)) {
            setUsernameError(t({
                id: 'auth.validation.username_characters',
                message: 'Use only lowercase letters and numbers.'
            }));
            hasError = true;
        } else if (username.length < 4 || username.length > 15) {
            setUsernameError(t({
                id: 'auth.validation.username_length',
                message: 'Username must be 4–15 lowercase letters or numbers.'
            }));
            hasError = true;
        }
        if (!name.trim()) {
            setNameError(t({
                id: 'auth.validation.display_name_required',
                message: 'Display name is required.'
            }));
            hasError = true;
        }
        if (!email.trim()) {
            setEmailError(t({
                id: 'auth.validation.email_required',
                message: 'Email is required.'
            }));
            hasError = true;
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            setEmailError(t({
                id: 'auth.validation.email_invalid',
                message: 'Enter a valid email address.'
            }));
            hasError = true;
        }
        if (!password) {
            setPasswordError(t({
                id: 'auth.validation.password_required',
                message: 'Password is required.'
            }));
            hasError = true;
        } else if (password.length < 8) {
            setPasswordError(t({
                id: 'auth.validation.password_too_short',
                message: 'Password must be at least 8 characters.'
            }));
            hasError = true;
        }
        if (!confirmPassword) {
            setConfirmPasswordError(t({
                id: 'auth.validation.confirm_password_required',
                message: 'Confirm your password.'
            }));
            hasError = true;
        } else if (password !== confirmPassword) {
            setConfirmPasswordError(t({
                id: 'auth.validation.password_mismatch',
                message: 'Passwords do not match.'
            }));
            hasError = true;
        }

        if (hasError) {
            return;
        }

        if (window.HCAPTCHA_SITE_KEY && !captchaToken) {
            setSignupError(t({
                id: 'auth.signup.complete_security_check',
                message: 'Complete the security check.'
            }));
            return;
        }

        setIsLoading(true);

        try {
            const formData = new URLSearchParams({
                'username': username,
                'name': name,
                'email': email,
                'password': password
            });

            if (window.INVITE_CODE) {
                formData.append('invite_code', window.INVITE_CODE);
            }

            if (captchaToken) {
                formData.append('h-captcha-response', captchaToken);
            }

            const response = await fetch('/v1/sign', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'X-CSRFToken': getCsrfToken()
                },
                body: formData
            });
            const data = await response.json();

            if (data.status === 'DONE') {
                window.location.assign(window.NEXT_URL || '/');
            } else {
                setSignupError(data.errorMessage || t({
                    id: 'auth.signup.failed',
                    message: 'Could not create your account.'
                }));
            }
        } catch {
            setSignupError(t({
                id: 'common.error.try_again',
                message: 'Something went wrong. Please try again.'
            }));
        } finally {
            setIsLoading(false);
        }
    };

    const nextUrl = window.NEXT_URL || '';
    const isInviteSignup = Boolean(window.INVITE_CODE);

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
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                    </svg>
                </div>
                <h1 className="text-3xl font-bold text-content mb-3 tracking-tight">
                    {isInviteSignup ? (
                        <Trans id="auth.signup.as_author">Sign up as an author</Trans>
                    ) : (
                        <Trans id="auth.signup.as_reader">Sign up as a reader</Trans>
                    )}
                </h1>
                <p className="text-content-secondary text-sm font-medium">
                    {isInviteSignup ? (
                        <Trans id="auth.signup.author_description">Create your invited author account</Trans>
                    ) : (
                        <Trans id="auth.signup.reader_description">Discover stories from independent authors</Trans>
                    )}
                </p>
            </div>

            {/* Main Signup Card */}
            <div className="bg-surface/60 backdrop-blur-2xl rounded-[2rem] shadow-elevated border border-line/40 p-8 md:p-10 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-surface/40 to-transparent pointer-events-none" />
                <div className="relative z-10">
                    {/* Signup Form */}
                    <form className="space-y-5" noValidate onSubmit={handleSubmit}>
                        <input type="hidden" name="csrfmiddlewaretoken" value={getCsrfToken()} />

                        <div className="space-y-4">
                            <div>
                                <label htmlFor="username" className="block text-xs font-semibold text-content-secondary mb-1.5 uppercase tracking-wide">
                                    <Trans id="auth.fields.username">Username</Trans>
                                </label>
                                <input
                                    id="username"
                                    name="username"
                                    type="text"
                                    autoComplete="username"
                                    required
                                    aria-invalid={Boolean(usernameError)}
                                    aria-describedby="signup-username-help"
                                    value={username}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        setUsername(val);
                                        if (val && !/^[a-z0-9]*$/.test(val)) {
                                            setUsernameError(t({
                                                id: 'auth.validation.username_characters',
                                                message: 'Use only lowercase letters and numbers.'
                                            }));
                                        } else if (val.length > 15) {
                                            setUsernameError(t({
                                                id: 'auth.validation.username_too_long',
                                                message: 'Username cannot exceed 15 characters.'
                                            }));
                                        } else {
                                            setUsernameError('');
                                        }
                                    }}
                                    className="w-full px-4 py-3.5 border border-line rounded-lg focus:ring-4 focus:ring-line/5 focus:border-line-strong/30 text-content placeholder-content-hint transition-all duration-200 bg-surface/40 text-sm font-medium"
                                    placeholder={t({
                                        id: 'auth.fields.username_hint',
                                        message: '4–15 lowercase letters or numbers'
                                    })}
                                />
                                {usernameError && <p id="signup-username-help" role="alert" className="text-danger text-xs mt-1.5 font-medium flex items-center gap-1"><i aria-hidden="true" className="fas fa-exclamation-circle" /> {usernameError}</p>}
                                {!usernameError && (
                                    <p id="signup-username-help" className="text-content-hint text-xs mt-1.5 font-medium">
                                        <Trans id="auth.fields.username_hint">4–15 lowercase letters or numbers</Trans>
                                    </p>
                                )}
                            </div>

                            <div>
                                <label htmlFor="name" className="block text-xs font-semibold text-content-secondary mb-1.5 uppercase tracking-wide">
                                    <Trans id="auth.fields.display_name">Display name</Trans>
                                </label>
                                <input
                                    id="name"
                                    name="name"
                                    type="text"
                                    autoComplete="name"
                                    required
                                    aria-invalid={Boolean(nameError)}
                                    aria-describedby={nameError ? 'signup-name-error' : undefined}
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="w-full px-4 py-3.5 border border-line rounded-lg focus:ring-4 focus:ring-line/5 focus:border-line-strong/30 text-content placeholder-content-hint transition-all duration-200 bg-surface/40 text-sm font-medium"
                                    placeholder={t({
                                        id: 'auth.fields.display_name_placeholder',
                                        message: 'Enter your display name'
                                    })}
                                />
                                {nameError && <p id="signup-name-error" role="alert" className="text-danger text-xs mt-1.5 font-medium flex items-center gap-1"><i aria-hidden="true" className="fas fa-exclamation-circle" /> {nameError}</p>}
                            </div>

                            <div>
                                <label htmlFor="email" className="block text-xs font-semibold text-content-secondary mb-1.5 uppercase tracking-wide">
                                    <Trans id="auth.fields.email">Email</Trans>
                                </label>
                                <input
                                    id="email"
                                    name="email"
                                    type="email"
                                    autoComplete="email"
                                    required
                                    aria-invalid={Boolean(emailError)}
                                    aria-describedby={emailError ? 'signup-email-error' : undefined}
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full px-4 py-3.5 border border-line rounded-lg focus:ring-4 focus:ring-line/5 focus:border-line-strong/30 text-content placeholder-content-hint transition-all duration-200 bg-surface/40 text-sm font-medium"
                                    placeholder={t({
                                        id: 'auth.fields.email_placeholder',
                                        message: 'Enter your email address'
                                    })}
                                />
                                {emailError && <p id="signup-email-error" role="alert" className="text-danger text-xs mt-1.5 font-medium flex items-center gap-1"><i aria-hidden="true" className="fas fa-exclamation-circle" /> {emailError}</p>}
                            </div>

                            <div>
                                <label htmlFor="password" className="block text-xs font-semibold text-content-secondary mb-1.5 uppercase tracking-wide">
                                    <Trans id="auth.fields.password">Password</Trans>
                                </label>
                                <input
                                    id="password"
                                    name="password"
                                    type="password"
                                    autoComplete="new-password"
                                    required
                                    minLength={8}
                                    aria-invalid={Boolean(passwordError)}
                                    aria-describedby={passwordError || passwordStrength ? 'signup-password-help' : undefined}
                                    value={password}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        setPassword(val);
                                        if (confirmPassword && val !== confirmPassword) {
                                            setConfirmPasswordError(t({
                                                id: 'auth.validation.password_mismatch',
                                                message: 'Passwords do not match.'
                                            }));
                                        } else if (confirmPassword) {
                                            setConfirmPasswordError('');
                                        }
                                    }}
                                    className="w-full px-4 py-3.5 border border-line rounded-lg focus:ring-4 focus:ring-line/5 focus:border-line-strong/30 text-content placeholder-content-hint transition-all duration-200 bg-surface/40 text-sm font-medium"
                                    placeholder={t({
                                        id: 'auth.fields.password_new_placeholder',
                                        message: 'Enter a secure password'
                                    })}
                                />
                                {passwordError && <p id="signup-password-help" role="alert" className="text-danger text-xs mt-1.5 font-medium flex items-center gap-1"><i aria-hidden="true" className="fas fa-exclamation-circle" /> {passwordError}</p>}
                                {!passwordError && passwordStrength && (
                                    <p id="signup-password-help" aria-live="polite" className={`text-xs mt-1.5 font-medium ${passwordStrength.color}`}>
                                        <Trans id="auth.signup.password_strength">
                                            Password strength: {passwordStrengthLabel}
                                        </Trans>
                                    </p>
                                )}
                            </div>

                            <div>
                                <label htmlFor="confirm-password" className="block text-xs font-semibold text-content-secondary mb-1.5 uppercase tracking-wide">
                                    <Trans id="auth.fields.confirm_password">Confirm password</Trans>
                                </label>
                                <input
                                    id="confirm-password"
                                    name="confirm-password"
                                    type="password"
                                    autoComplete="new-password"
                                    required
                                    aria-invalid={Boolean(confirmPasswordError)}
                                    aria-describedby={confirmPasswordError ? 'signup-confirm-password-error' : undefined}
                                    value={confirmPassword}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        setConfirmPassword(val);
                                        if (val && password && val !== password) {
                                            setConfirmPasswordError(t({
                                                id: 'auth.validation.password_mismatch',
                                                message: 'Passwords do not match.'
                                            }));
                                        } else {
                                            setConfirmPasswordError('');
                                        }
                                    }}
                                    className="w-full px-4 py-3.5 border border-line rounded-lg focus:ring-4 focus:ring-line/5 focus:border-line-strong/30 text-content placeholder-content-hint transition-all duration-200 bg-surface/40 text-sm font-medium"
                                    placeholder={t({
                                        id: 'auth.fields.confirm_password_placeholder',
                                        message: 'Enter your password again'
                                    })}
                                />
                                {confirmPasswordError && <p id="signup-confirm-password-error" role="alert" className="text-danger text-xs mt-1.5 font-medium flex items-center gap-1"><i aria-hidden="true" className="fas fa-exclamation-circle" /> {confirmPasswordError}</p>}
                            </div>
                        </div>

                        {/* HCaptcha Widget */}
                        {window.HCAPTCHA_SITE_KEY && (
                            <div className="flex justify-center py-2">
                                <div ref={captchaRef} className="transform scale-100 origin-center" />
                            </div>
                        )}

                        {signupError && (
                            <div role="alert" className="bg-danger-surface border border-danger-line rounded-xl p-4 flex items-center gap-3">
                                <i aria-hidden="true" className="fas fa-exclamation-triangle text-danger" />
                                <p className="text-danger text-sm font-medium">{signupError}</p>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full flex items-center justify-center py-3.5 px-6 bg-action hover:bg-action-hover text-content-inverted font-semibold rounded-lg shadow-floating hover:shadow-floating hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none text-sm">
                            {isLoading ? (
                                <>
                                    <svg
                                        aria-hidden="true"
                                        className="animate-spin -ml-1 mr-2 h-4 w-4 text-content-inverted"
                                        xmlns="http://www.w3.org/2000/svg"
                                        fill="none"
                                        viewBox="0 0 24 24">
                                        <circle
                                            className="opacity-25"
                                            cx="12"
                                            cy="12"
                                            r="10"
                                            stroke="currentColor"
                                            strokeWidth="4"
                                        />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                    </svg>
                                    <span><Trans id="common.processing">Processing...</Trans></span>
                                </>
                            ) : (
                                isInviteSignup ? (
                                    <Trans id="auth.signup.as_author">Sign up as an author</Trans>
                                ) : (
                                    <Trans id="auth.signup.as_reader">Sign up as a reader</Trans>
                                )
                            )}
                        </button>
                    </form>

                    <SocialLogin />

                    {/* Footer Links */}
                    <div className="text-center pt-6 border-t border-line-light/50">
                        <p className="text-sm text-content-secondary font-medium">
                            <Trans id="auth.signup.already_have_account">Already have an account?</Trans>
                            <a href={`/login${nextUrl ? '?next=' + encodeURIComponent(nextUrl) : ''}`} className="font-bold text-content hover:text-content transition-colors duration-200 ml-1 underline decoration-2 underline-offset-2">
                                <Trans id="auth.login.title">Log in</Trans>
                            </a>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Signup;
