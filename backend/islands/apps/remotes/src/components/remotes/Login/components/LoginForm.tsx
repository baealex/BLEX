import React, { useEffect, useRef } from 'react';
import SocialLogin from '~/components/remotes/SocialLogin';

interface LoginFormProps {
    username: string;
    password: string;
    usernameError: string;
    passwordError: string;
    loginError: string;
    isLoading: boolean;
    showCaptcha?: boolean;
    onUsernameChange: (value: string) => void;
    onPasswordChange: (value: string) => void;
    onSubmit: (e: React.FormEvent) => void;
    onCaptchaVerify?: (token: string) => void;
}

declare global {
    interface Window {
        hcaptcha?: {
            render: (container: string | HTMLElement, params: unknown) => string;
            reset: (widgetId?: string) => void;
            remove: (widgetId?: string) => void;
        };
        HCAPTCHA_SITE_KEY?: string;
    }
}

const getCsrfToken = (): string => {
    const token = document.querySelector<HTMLInputElement>('[name=csrfmiddlewaretoken]')?.value;
    return token || '';
};

const LoginForm = ({
    username,
    password,
    usernameError,
    passwordError,
    loginError,
    isLoading,
    showCaptcha = false,
    onUsernameChange,
    onPasswordChange,
    onSubmit,
    onCaptchaVerify
}: LoginFormProps) => {
    const captchaRef = useRef<HTMLDivElement>(null);
    const widgetIdRef = useRef<string | null>(null);

    useEffect(() => {
        if (showCaptcha && captchaRef.current && window.hcaptcha && window.HCAPTCHA_SITE_KEY) {
            // Remove existing widget if any
            if (widgetIdRef.current) {
                try {
                    window.hcaptcha.remove(widgetIdRef.current);
                } catch {
                    // Ignore errors
                }
            }

            // Render new hCaptcha widget
            try {
                widgetIdRef.current = window.hcaptcha.render(captchaRef.current, {
                    sitekey: window.HCAPTCHA_SITE_KEY,
                    theme: 'light',
                    size: 'normal',
                    callback: (token: string) => {
                        if (onCaptchaVerify) {
                            onCaptchaVerify(token);
                        }
                    }
                });
            } catch (e) {
                console.error('Failed to render hCaptcha:', e);
            }
        }

        return () => {
            // Cleanup on unmount
            if (widgetIdRef.current && window.hcaptcha) {
                try {
                    window.hcaptcha.remove(widgetIdRef.current);
                } catch {
                    // Ignore errors
                }
            }
        };
    }, [showCaptcha, onCaptchaVerify]);

    return (
        <>
            {/* Email Login Form */}
            <form className="space-y-5" onSubmit={onSubmit}>
                <input type="hidden" name="csrfmiddlewaretoken" value={getCsrfToken()} />

                <div className="space-y-4">
                    <div>
                        <label htmlFor="username" className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
                            사용자 이름
                        </label>
                        <input
                            id="username"
                            name="username"
                            type="text"
                            autoComplete="username"
                            required
                            value={username}
                            onChange={(e) => onUsernameChange(e.target.value)}
                            className="w-full px-4 py-3.5 border border-gray-200 rounded-2xl focus:ring-4 focus:ring-black/5 focus:border-black/30 text-gray-900 placeholder-gray-400 transition-all duration-200 bg-white/40 text-sm font-medium"
                            placeholder="사용자 이름을 입력하세요"
                        />
                        {usernameError && (
                            <p className="text-red-500 text-xs mt-1.5 font-medium flex items-center gap-1">
                                <i className="fas fa-exclamation-circle" /> {usernameError}
                            </p>
                        )}
                    </div>

                    <div>
                        <label htmlFor="password" className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
                            비밀번호
                        </label>
                        <input
                            id="password"
                            name="password"
                            type="password"
                            autoComplete="current-password"
                            required
                            value={password}
                            onChange={(e) => onPasswordChange(e.target.value)}
                            className="w-full px-4 py-3.5 border border-gray-200 rounded-2xl focus:ring-4 focus:ring-black/5 focus:border-black/30 text-gray-900 placeholder-gray-400 transition-all duration-200 bg-white/40 text-sm font-medium"
                            placeholder="비밀번호를 입력하세요"
                        />
                        {passwordError && (
                            <p className="text-red-500 text-xs mt-1.5 font-medium flex items-center gap-1">
                                <i className="fas fa-exclamation-circle" /> {passwordError}
                            </p>
                        )}
                    </div>
                </div>

                {/* HCaptcha */}
                {showCaptcha && (
                    <div className="flex justify-center py-2">
                        <div ref={captchaRef} className="transform scale-100 origin-center" />
                    </div>
                )}

                {/* Error Message */}
                {loginError && (
                    <div className="bg-red-50 border border-red-100 rounded-xl p-4 flex items-center gap-3">
                        <i className="fas fa-exclamation-triangle text-red-500" />
                        <p className="text-red-600 text-sm font-medium">{loginError}</p>
                    </div>
                )}

                {/* Submit Button */}
                <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full flex items-center justify-center py-3.5 px-6 bg-black hover:bg-gray-800 text-white font-semibold rounded-2xl shadow-lg shadow-black/20 hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none text-sm">
                    {isLoading && (
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
                    )}
                    <span>{isLoading ? '로그인 중...' : '로그인'}</span>
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
        </>
    );
};

export default LoginForm;
