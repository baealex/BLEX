import React, { useEffect, useState } from 'react';
import { useLoginState } from './hooks/useLoginState';
import LoginForm from './components/LoginForm';
import TwoFactorForm from './components/TwoFactorForm';
import { login } from '~/lib/api';

const Login = () => {
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
            updates.usernameError = '사용자 이름이 필요합니다.';
            hasError = true;
        }
        if (!state.password) {
            updates.passwordError = '비밀번호가 필요합니다.';
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
                    window.location.href = nextUrl || '/';
                }
            } else {
                handleFailedLogin();
                updateState({ loginError: '잘못된 사용자 이름 또는 비밀번호입니다.' });
            }
        } catch {
            handleFailedLogin();
            updateState({ loginError: '오류가 발생했습니다. 다시 시도해주세요.' });
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
                verificationError: '올바른 6자리 숫자 코드를 입력해주세요.',
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
                    successMessage: '인증이 완료되었습니다. 잠시 후 홈 페이지로 이동합니다.'
                });
                setTimeout(() => {
                    window.location.href = nextUrl || '/';
                }, 1000);
            } else {
                const isBlocked = handleFailedTwoFactor();
                if (!isBlocked) {
                    updateState({
                        verificationError: '잘못된 인증 코드입니다.',
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
            updateState({ verificationError: '오류가 발생했습니다. 다시 시도해주세요.' });
        } finally {
            updateState({ isTwoFactorLoading: false });
        }
    };

    return (
        <div className={`max-w-[420px] w-full transition-all duration-700 ease-out transform ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
            {/* Logo & Title */}
            <div className="text-center mb-8">
                <div className="mx-auto h-16 w-16 bg-black rounded-2xl flex items-center justify-center mb-6 shadow-2xl shadow-black/20 ring-1 ring-white/20">
                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                </div>
                <h1 className="text-3xl font-bold text-gray-900 mb-3 tracking-tight">
                    {state.showTwoFactor ? '이중 인증' : '로그인'}
                </h1>
                <p className="text-gray-500 text-sm font-medium">
                    {state.showTwoFactor ? '인증 앱에서 생성된 6자리 코드를 입력해주세요' : '돌아오신 것을 환영해요'}
                </p>
            </div>

            {/* Main Login Card */}
            <div className="bg-white/60 backdrop-blur-2xl rounded-[2rem] shadow-2xl shadow-black/5 border border-white/40 p-8 md:p-10 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-white/40 to-transparent pointer-events-none" />
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
                    <div className="text-center pt-8 mt-2">
                        {!state.showTwoFactor && (
                            <p className="text-sm text-gray-500 font-medium">
                                계정이 없으신가요?
                                <a href={`/sign${nextUrl ? '?next=' + encodeURIComponent(nextUrl) : ''}`} className="font-bold text-black hover:text-gray-700 transition-colors duration-200 ml-1">
                                    회원가입
                                </a>
                            </p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Login;
