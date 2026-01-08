import React, { useEffect, useRef, useState } from 'react';
import SocialLogin from '~/components/remotes/SocialLogin';

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
    const [captchaRendered, setCaptchaRendered] = useState(false);
    const [isVisible, setIsVisible] = useState(false);

    const captchaRef = useRef<HTMLDivElement>(null);
    const widgetIdRef = useRef<string | null>(null);

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
    }, []);

    const renderCaptcha = () => {
        if (!captchaRendered && captchaRef.current && window.hcaptcha && window.HCAPTCHA_SITE_KEY) {
            try {
                widgetIdRef.current = window.hcaptcha.render(captchaRef.current, {
                    sitekey: window.HCAPTCHA_SITE_KEY,
                    theme: 'light',
                    size: 'normal',
                    callback: (token: string) => {
                        setCaptchaToken(token);
                    }
                });
                setCaptchaRendered(true);
            } catch (e) {
                console.error('Failed to render hCaptcha:', e);
            }
        }
    };

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
                window.location.href = window.NEXT_URL || '/';
            } else {
                setSignupError(data.errorMessage || '회원가입에 실패했습니다.');
            }
        } catch (error) {
            setSignupError('오류가 발생했습니다. 다시 시도해주세요.');
            console.error('Error:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const nextUrl = window.NEXT_URL || '';

    return (
        <div className={`w-[420px] max-w-[90vw] transition-all duration-700 ease-out transform ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
            {/* Logo & Title */}
            <div className="text-center mb-8">
                <div className="mx-auto h-16 w-16 bg-black rounded-2xl flex items-center justify-center mb-6 shadow-2xl shadow-black/20 ring-1 ring-white/20">
                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                    </svg>
                </div>
                <h1 className="text-3xl font-bold text-gray-900 mb-3 tracking-tight">
                    독자로 가입하기
                </h1>
                <p className="text-gray-500 text-sm font-medium">
                    에디터들의 이야기를 읽어보세요
                </p>
            </div>

            {/* Main Signup Card */}
            <div className="bg-white/60 backdrop-blur-2xl rounded-[2rem] shadow-2xl shadow-black/5 border border-white/40 p-8 md:p-10 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-white/40 to-transparent pointer-events-none" />
                <div className="relative z-10">
                    {/* Signup Form */}
                    <form className="space-y-5" onSubmit={handleSubmit}>
                        <input type="hidden" name="csrfmiddlewaretoken" value={getCsrfToken()} />

                        <div className="space-y-4">
                            <div>
                                <label htmlFor="username" className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">사용자 이름</label>
                                <input
                                    id="username"
                                    name="username"
                                    type="text"
                                    autoComplete="username"
                                    required
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    className="w-full px-4 py-3.5 border border-gray-200 rounded-2xl focus:ring-4 focus:ring-black/5 focus:border-black/30 text-gray-900 placeholder-gray-400 transition-all duration-200 bg-white/40 text-sm font-medium"
                                    placeholder="4-15자 영문 소문자, 숫자"
                                />
                                {usernameError && <p className="text-red-500 text-xs mt-1.5 font-medium flex items-center gap-1"><i className="fas fa-exclamation-circle" /> {usernameError}</p>}
                            </div>

                            <div>
                                <label htmlFor="name" className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">이름</label>
                                <input
                                    id="name"
                                    name="name"
                                    type="text"
                                    autoComplete="name"
                                    required
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="w-full px-4 py-3.5 border border-gray-200 rounded-2xl focus:ring-4 focus:ring-black/5 focus:border-black/30 text-gray-900 placeholder-gray-400 transition-all duration-200 bg-white/40 text-sm font-medium"
                                    placeholder="표시할 이름을 입력하세요"
                                />
                                {nameError && <p className="text-red-500 text-xs mt-1.5 font-medium flex items-center gap-1"><i className="fas fa-exclamation-circle" /> {nameError}</p>}
                            </div>

                            <div>
                                <label htmlFor="email" className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">이메일</label>
                                <input
                                    id="email"
                                    name="email"
                                    type="email"
                                    autoComplete="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full px-4 py-3.5 border border-gray-200 rounded-2xl focus:ring-4 focus:ring-black/5 focus:border-black/30 text-gray-900 placeholder-gray-400 transition-all duration-200 bg-white/40 text-sm font-medium"
                                    placeholder="이메일 주소를 입력하세요"
                                />
                                {emailError && <p className="text-red-500 text-xs mt-1.5 font-medium flex items-center gap-1"><i className="fas fa-exclamation-circle" /> {emailError}</p>}
                            </div>

                            <div>
                                <label htmlFor="password" className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">비밀번호</label>
                                <input
                                    id="password"
                                    name="password"
                                    type="password"
                                    autoComplete="new-password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full px-4 py-3.5 border border-gray-200 rounded-2xl focus:ring-4 focus:ring-black/5 focus:border-black/30 text-gray-900 placeholder-gray-400 transition-all duration-200 bg-white/40 text-sm font-medium"
                                    placeholder="안전한 비밀번호를 입력하세요"
                                />
                                {passwordError && <p className="text-red-500 text-xs mt-1.5 font-medium flex items-center gap-1"><i className="fas fa-exclamation-circle" /> {passwordError}</p>}
                            </div>

                            <div>
                                <label htmlFor="confirm-password" className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">비밀번호 확인</label>
                                <input
                                    id="confirm-password"
                                    name="confirm-password"
                                    type="password"
                                    autoComplete="new-password"
                                    required
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="w-full px-4 py-3.5 border border-gray-200 rounded-2xl focus:ring-4 focus:ring-black/5 focus:border-black/30 text-gray-900 placeholder-gray-400 transition-all duration-200 bg-white/40 text-sm font-medium"
                                    placeholder="비밀번호를 다시 입력하세요"
                                />
                                {confirmPasswordError && <p className="text-red-500 text-xs mt-1.5 font-medium flex items-center gap-1"><i className="fas fa-exclamation-circle" /> {confirmPasswordError}</p>}
                            </div>
                        </div>

                        {/* HCaptcha Widget */}
                        {window.HCAPTCHA_SITE_KEY && (
                            <div className="flex justify-center py-2">
                                <div ref={captchaRef} className="transform scale-100 origin-center" />
                            </div>
                        )}

                        {signupError && (
                            <div className="bg-red-50 border border-red-100 rounded-xl p-4 flex items-center gap-3">
                                <i className="fas fa-exclamation-triangle text-red-500" />
                                <p className="text-red-600 text-sm font-medium">{signupError}</p>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full flex items-center justify-center py-3.5 px-6 bg-black hover:bg-gray-800 text-white font-semibold rounded-2xl shadow-lg shadow-black/20 hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none text-sm">
                            {isLoading ? (
                                <>
                                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
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
                            <div className="w-full border-t border-gray-200" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase tracking-wider">
                            <span className="px-4 bg-white/50 backdrop-blur-sm text-gray-400 font-medium">
                                또는 간편하게
                            </span>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <SocialLogin />
                    </div>

                    {/* Footer Links */}
                    <div className="text-center pt-6 border-t border-gray-100/50">
                        <p className="text-sm text-gray-500 font-medium">
                            이미 계정이 있으신가요?
                            <a href={`/login${nextUrl ? '?next=' + encodeURIComponent(nextUrl) : ''}`} className="font-bold text-black hover:text-gray-700 transition-colors duration-200 ml-1 underline decoration-2 underline-offset-2">
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
