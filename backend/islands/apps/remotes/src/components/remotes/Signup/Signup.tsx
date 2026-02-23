import React, { useCallback, useEffect, useRef, useState } from 'react';
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
    }
}

const getCsrfToken = (): string => {
    const token = document.querySelector<HTMLInputElement>('[name=csrfmiddlewaretoken]')?.value;
    return token || '';
};

interface PasswordStrength {
    label: string;
    color: string;
}

const getPasswordStrength = (pw: string): PasswordStrength | null => {
    if (!pw) return null;
    if (pw.length < 6) {
        return {
            label: '너무 짧음',
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
            label: '약함',
            color: 'text-warning'
        };
    }
    if (score <= 2) {
        return {
            label: '보통',
            color: 'text-warning'
        };
    }
    return {
        label: '강함',
        color: 'text-success'
    };
};

const Signup = () => {
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
        setIsLoading(true);

        let hasError = false;
        if (!username) {
            setUsernameError('사용자 이름이 필요합니다.');
            hasError = true;
        }
        if (!name) {
            setNameError('이름이 필요합니다.');
            hasError = true;
        }
        if (!email) {
            setEmailError('이메일이 필요합니다.');
            hasError = true;
        }
        if (!password) {
            setPasswordError('비밀번호가 필요합니다.');
            hasError = true;
        }
        if (password !== confirmPassword) {
            setConfirmPasswordError('비밀번호가 일치하지 않습니다.');
            hasError = true;
        }

        if (hasError) {
            setIsLoading(false);
            return;
        }

        if (window.HCAPTCHA_SITE_KEY && !captchaToken) {
            setSignupError('보안 검증을 완료해주세요.');
            setIsLoading(false);
            return;
        }

        try {
            const formData = new URLSearchParams({
                'username': username,
                'name': name,
                'email': email,
                'password': password
            });

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
                setSignupError(data.errorMessage || '회원가입에 실패했습니다.');
            }
        } catch {
            setSignupError('오류가 발생했습니다. 다시 시도해주세요.');
        } finally {
            setIsLoading(false);
        }
    };

    const nextUrl = window.NEXT_URL || '';

    return (
        <div className={`w-[420px] max-w-[90vw] transition-all duration-700 ease-out transform ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
            {/* Logo & Title */}
            <div className="text-center mb-8">
                <div className="mx-auto h-16 w-16 bg-action rounded-2xl flex items-center justify-center mb-6 shadow-floating ring-1 ring-line/20">
                    <svg className="w-8 h-8 text-content-inverted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                    </svg>
                </div>
                <h1 className="text-3xl font-bold text-content mb-3 tracking-tight">
                    독자로 가입하기
                </h1>
                <p className="text-content-secondary text-sm font-medium">
                    에디터들의 이야기를 읽어보세요
                </p>
            </div>

            {/* Main Signup Card */}
            <div className="bg-surface/60 backdrop-blur-2xl rounded-[2rem] shadow-elevated border border-line/40 p-8 md:p-10 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-surface/40 to-transparent pointer-events-none" />
                <div className="relative z-10">
                    {/* Signup Form */}
                    <form className="space-y-5" onSubmit={handleSubmit}>
                        <input type="hidden" name="csrfmiddlewaretoken" value={getCsrfToken()} />

                        <div className="space-y-4">
                            <div>
                                <label htmlFor="username" className="block text-xs font-semibold text-content-secondary mb-1.5 uppercase tracking-wide">사용자 이름</label>
                                <input
                                    id="username"
                                    name="username"
                                    type="text"
                                    autoComplete="username"
                                    required
                                    value={username}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        setUsername(val);
                                        if (val && !/^[a-z0-9]*$/.test(val)) {
                                            setUsernameError('영문 소문자와 숫자만 사용할 수 있습니다.');
                                        } else if (val.length > 15) {
                                            setUsernameError('15자를 초과할 수 없습니다.');
                                        } else {
                                            setUsernameError('');
                                        }
                                    }}
                                    className="w-full px-4 py-3.5 border border-line rounded-lg focus:ring-4 focus:ring-line/5 focus:border-line-strong/30 text-content placeholder-content-hint transition-all duration-200 bg-surface/40 text-sm font-medium"
                                    placeholder="4-15자 영문 소문자, 숫자"
                                />
                                {usernameError && <p className="text-danger text-xs mt-1.5 font-medium flex items-center gap-1"><i className="fas fa-exclamation-circle" /> {usernameError}</p>}
                                {!usernameError && <p className="text-content-hint text-xs mt-1.5 font-medium">4-15자 영문 소문자, 숫자</p>}
                            </div>

                            <div>
                                <label htmlFor="name" className="block text-xs font-semibold text-content-secondary mb-1.5 uppercase tracking-wide">이름</label>
                                <input
                                    id="name"
                                    name="name"
                                    type="text"
                                    autoComplete="name"
                                    required
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="w-full px-4 py-3.5 border border-line rounded-lg focus:ring-4 focus:ring-line/5 focus:border-line-strong/30 text-content placeholder-content-hint transition-all duration-200 bg-surface/40 text-sm font-medium"
                                    placeholder="표시할 이름을 입력하세요"
                                />
                                {nameError && <p className="text-danger text-xs mt-1.5 font-medium flex items-center gap-1"><i className="fas fa-exclamation-circle" /> {nameError}</p>}
                            </div>

                            <div>
                                <label htmlFor="email" className="block text-xs font-semibold text-content-secondary mb-1.5 uppercase tracking-wide">이메일</label>
                                <input
                                    id="email"
                                    name="email"
                                    type="email"
                                    autoComplete="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full px-4 py-3.5 border border-line rounded-lg focus:ring-4 focus:ring-line/5 focus:border-line-strong/30 text-content placeholder-content-hint transition-all duration-200 bg-surface/40 text-sm font-medium"
                                    placeholder="이메일 주소를 입력하세요"
                                />
                                {emailError && <p className="text-danger text-xs mt-1.5 font-medium flex items-center gap-1"><i className="fas fa-exclamation-circle" /> {emailError}</p>}
                            </div>

                            <div>
                                <label htmlFor="password" className="block text-xs font-semibold text-content-secondary mb-1.5 uppercase tracking-wide">비밀번호</label>
                                <input
                                    id="password"
                                    name="password"
                                    type="password"
                                    autoComplete="new-password"
                                    required
                                    value={password}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        setPassword(val);
                                        if (confirmPassword && val !== confirmPassword) {
                                            setConfirmPasswordError('비밀번호가 일치하지 않습니다.');
                                        } else if (confirmPassword) {
                                            setConfirmPasswordError('');
                                        }
                                    }}
                                    className="w-full px-4 py-3.5 border border-line rounded-lg focus:ring-4 focus:ring-line/5 focus:border-line-strong/30 text-content placeholder-content-hint transition-all duration-200 bg-surface/40 text-sm font-medium"
                                    placeholder="안전한 비밀번호를 입력하세요"
                                />
                                {passwordError && <p className="text-danger text-xs mt-1.5 font-medium flex items-center gap-1"><i className="fas fa-exclamation-circle" /> {passwordError}</p>}
                                {!passwordError && passwordStrength && (
                                    <p className={`text-xs mt-1.5 font-medium ${passwordStrength.color}`}>
                                        비밀번호 강도: {passwordStrength.label}
                                    </p>
                                )}
                            </div>

                            <div>
                                <label htmlFor="confirm-password" className="block text-xs font-semibold text-content-secondary mb-1.5 uppercase tracking-wide">비밀번호 확인</label>
                                <input
                                    id="confirm-password"
                                    name="confirm-password"
                                    type="password"
                                    autoComplete="new-password"
                                    required
                                    value={confirmPassword}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        setConfirmPassword(val);
                                        if (val && password && val !== password) {
                                            setConfirmPasswordError('비밀번호가 일치하지 않습니다.');
                                        } else {
                                            setConfirmPasswordError('');
                                        }
                                    }}
                                    className="w-full px-4 py-3.5 border border-line rounded-lg focus:ring-4 focus:ring-line/5 focus:border-line-strong/30 text-content placeholder-content-hint transition-all duration-200 bg-surface/40 text-sm font-medium"
                                    placeholder="비밀번호를 다시 입력하세요"
                                />
                                {confirmPasswordError && <p className="text-danger text-xs mt-1.5 font-medium flex items-center gap-1"><i className="fas fa-exclamation-circle" /> {confirmPasswordError}</p>}
                            </div>
                        </div>

                        {/* HCaptcha Widget */}
                        {window.HCAPTCHA_SITE_KEY && (
                            <div className="flex justify-center py-2">
                                <div ref={captchaRef} className="transform scale-100 origin-center" />
                            </div>
                        )}

                        {signupError && (
                            <div className="bg-danger-surface border border-danger-line rounded-xl p-4 flex items-center gap-3">
                                <i className="fas fa-exclamation-triangle text-danger" />
                                <p className="text-danger text-sm font-medium">{signupError}</p>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full flex items-center justify-center py-3.5 px-6 bg-action hover:bg-action-hover text-content-inverted font-semibold rounded-lg shadow-floating hover:shadow-floating hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none text-sm">
                            {isLoading ? (
                                <>
                                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-content-inverted" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
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
                                    <span>처리 중...</span>
                                </>
                            ) : (
                                '독자로 가입하기'
                            )}
                        </button>
                    </form>

                    {/* Divider */}
                    <div className="relative py-4">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-line" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase tracking-wider">
                            <span className="px-4 bg-surface/50 backdrop-blur-sm text-content-hint font-medium">
                                또는 간편하게
                            </span>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <SocialLogin />
                    </div>

                    {/* Footer Links */}
                    <div className="text-center pt-6 border-t border-line-light/50">
                        <p className="text-sm text-content-secondary font-medium">
                            이미 계정이 있으신가요?
                            <a href={`/login${nextUrl ? '?next=' + encodeURIComponent(nextUrl) : ''}`} className="font-bold text-content hover:text-content transition-colors duration-200 ml-1 underline decoration-2 underline-offset-2">
                                로그인
                            </a>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Signup;
