import React from 'react';
import SocialLogin from '~/components/remotes/SocialLogin';

interface LoginFormProps {
    username: string;
    password: string;
    usernameError: string;
    passwordError: string;
    loginError: string;
    isLoading: boolean;
    onUsernameChange: (value: string) => void;
    onPasswordChange: (value: string) => void;
    onSubmit: (e: React.FormEvent) => void;
}

const getCsrfToken = (): string => {
    const token = document.querySelector<HTMLInputElement>('[name=csrfmiddlewaretoken]')?.value;
    return token || '';
};

const LoginForm: React.FC<LoginFormProps> = ({
    username,
    password,
    usernameError,
    passwordError,
    loginError,
    isLoading,
    onUsernameChange,
    onPasswordChange,
    onSubmit
}) => {
    return (
        <>
            {/* Email Login Form */}
            <form className="space-y-6" onSubmit={onSubmit}>
                <input type="hidden" name="csrfmiddlewaretoken" value={getCsrfToken()} />

                <div>
                    <label htmlFor="username" className="block text-sm font-semibold text-gray-700 mb-2">
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
                        className="w-full px-4 py-3 border border-solid border-gray-300 rounded-xl focus:ring-2 focus:ring-gray-500 focus:border-transparent text-gray-900 placeholder-slate-500 transition-all duration-200 bg-white/50"
                        placeholder="사용자 이름을 입력하세요"
                    />
                    {usernameError && (
                        <p className="text-gray-500 text-sm mt-1.5 font-medium">{usernameError}</p>
                    )}
                </div>

                <div>
                    <label htmlFor="password" className="block text-sm font-semibold text-gray-700 mb-2">
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
                        className="w-full px-4 py-3 border border-solid border-gray-300 rounded-xl focus:ring-2 focus:ring-gray-500 focus:border-transparent text-gray-900 placeholder-slate-500 transition-all duration-200 bg-white/50"
                        placeholder="비밀번호를 입력하세요"
                    />
                    {passwordError && (
                        <p className="text-gray-500 text-sm mt-1.5 font-medium">{passwordError}</p>
                    )}
                </div>

                {/* Error Message */}
                {loginError && (
                    <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                        <p className="text-gray-700 text-sm font-medium text-center">{loginError}</p>
                    </div>
                )}

                {/* Submit Button */}
                <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full flex items-center justify-center py-3 px-6 bg-gradient-to-r from-gray-600 to-gray-600 hover:from-gray-700 hover:to-gray-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none">
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
                    <span>{isLoading ? '로그인 중...' : '로그인'}</span>
                </button>
            </form>

            {/* Divider */}
            <div className="relative">
                <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-300 border-solid" />
                </div>
                <div className="relative flex justify-center text-sm">
                    <span className="px-4 bg-white text-gray-500 font-medium">
                        또는 간편 로그인
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
