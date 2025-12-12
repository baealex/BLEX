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

    const captchaRef = useRef<HTMLDivElement>(null);
    const widgetIdRef = useRef<string | null>(null);

    useEffect(() => {
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
        <div className="max-w-md w-full space-y-8">
            {/* Logo & Title */}
            <div className="text-center">
                <div className="mx-auto h-20 w-20 bg-gradient-to-br from-gray-900 to-gray-700 rounded-3xl flex items-center justify-center mt-8 mb-8 shadow-2xl">
                    <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                </div>
                <h1 className="text-2xl font-bold text-gray-900 mb-3 tracking-tight">
                    독자로 가입하기
                </h1>
                <p className="text-lg text-gray-600 mb-6 max-w-md mx-auto leading-relaxed">
                    작가들의 이야기를 읽고,<br />
                    댓글과 좋아요로 응원해보세요
                </p>

                {/* Benefits */}
                <div className="flex flex-col sm:flex-row gap-4 justify-center items-center text-sm text-gray-500 mb-8">
                    <div className="flex items-center gap-2">
                        <svg className="w-5 h-5 text-gray-900" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <span className="font-medium">무료로 모든 글 읽기</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <svg className="w-5 h-5 text-gray-900" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <span className="font-medium">작가와 소통하기</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <svg className="w-5 h-5 text-gray-900" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <span className="font-medium">북마크로 모아보기</span>
                    </div>
                </div>
            </div>

            {/* Main Signup Card */}
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 p-8 space-y-8">
                {/* Signup Form */}
                <form className="space-y-6" onSubmit={handleSubmit}>
                    <input type="hidden" name="csrfmiddlewaretoken" value={getCsrfToken()} />

                    <div className="space-y-5">
                        <div>
                            <label htmlFor="username" className="block text-sm font-semibold text-gray-700 mb-2">사용자 이름</label>
                            <input
                                id="username"
                                name="username"
                                type="text"
                                autoComplete="username"
                                required
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder-slate-500 transition-all duration-200 bg-white/50"
                                placeholder="4-15자 영문 소문자, 숫자"
                            />
                            {usernameError && <p className="text-gray-900 text-sm mt-1.5 font-medium">{usernameError}</p>}
                        </div>

                        <div>
                            <label htmlFor="name" className="block text-sm font-semibold text-gray-700 mb-2">이름</label>
                            <input
                                id="name"
                                name="name"
                                type="text"
                                autoComplete="name"
                                required
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder-slate-500 transition-all duration-200 bg-white/50"
                                placeholder="표시할 이름을 입력하세요"
                            />
                            {nameError && <p className="text-gray-900 text-sm mt-1.5 font-medium">{nameError}</p>}
                        </div>

                        <div>
                            <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-2">이메일</label>
                            <input
                                id="email"
                                name="email"
                                type="email"
                                autoComplete="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder-slate-500 transition-all duration-200 bg-white/50"
                                placeholder="이메일 주소를 입력하세요"
                            />
                            {emailError && <p className="text-gray-900 text-sm mt-1.5 font-medium">{emailError}</p>}
                        </div>

                        <div>
                            <label htmlFor="password" className="block text-sm font-semibold text-gray-700 mb-2">비밀번호</label>
                            <input
                                id="password"
                                name="password"
                                type="password"
                                autoComplete="new-password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder-slate-500 transition-all duration-200 bg-white/50"
                                placeholder="안전한 비밀번호를 입력하세요"
                            />
                            {passwordError && <p className="text-gray-900 text-sm mt-1.5 font-medium">{passwordError}</p>}
                        </div>

                        <div>
                            <label htmlFor="confirm-password" className="block text-sm font-semibold text-gray-700 mb-2">비밀번호 확인</label>
                            <input
                                id="confirm-password"
                                name="confirm-password"
                                type="password"
                                autoComplete="new-password"
                                required
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder-slate-500 transition-all duration-200 bg-white/50"
                                placeholder="비밀번호를 다시 입력하세요"
                            />
                            {confirmPasswordError && <p className="text-gray-900 text-sm mt-1.5 font-medium">{confirmPasswordError}</p>}
                        </div>
                    </div>

                    {/* HCaptcha Widget */}
                    {window.HCAPTCHA_SITE_KEY && (
                        <div className="flex justify-center">
                            <div ref={captchaRef} className="transform scale-100 origin-center" />
                        </div>
                    )}

                    {signupError && (
                        <div className="bg-gray-100 border border-gray-300 rounded-xl p-4">
                            <p className="text-gray-900 text-sm font-medium text-center">{signupError}</p>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full flex items-center justify-center py-4 px-6 bg-gray-900 hover:bg-gray-800 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none text-base">
                        {isLoading && (
                            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
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
                        )}
                        <span>{isLoading ? '계정 만드는 중...' : '독자로 가입하기'}</span>
                    </button>
                </form>

                {/* Divider */}
                <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-gray-200" />
                    </div>
                    <div className="relative flex justify-center text-sm">
                        <span className="px-4 bg-white text-gray-500 font-medium">
                            또는 간편하게
                        </span>
                    </div>
                </div>

                <div className="space-y-3">
                    <SocialLogin />
                </div>

                {/* Footer Links */}
                <div className="text-center space-y-5 pt-6 border-t border-gray-100">
                    <p className="text-base text-gray-600">
                        이미 독자이신가요?
                        <a href={`/login${nextUrl ? '?next=' + encodeURIComponent(nextUrl) : ''}`} className="font-bold text-gray-900 hover:text-gray-700 transition-colors duration-200 ml-1 underline decoration-2 underline-offset-2">
                            로그인
                        </a>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Signup;
