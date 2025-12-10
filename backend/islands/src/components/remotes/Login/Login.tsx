import React from 'react';
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
        <div className="max-w-md w-full space-y-8">
            {/* Logo & Title */}
            <div className="text-center">
                <div className="mx-auto h-20 w-20 bg-gradient-to-br from-gray-900 to-gray-700 rounded-3xl flex items-center justify-center mt-8 mb-8 shadow-2xl">
                    <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                </div>
                <h1 className="text-2xl font-bold text-gray-900 mb-3 tracking-tight">
                    {state.showTwoFactor ? '이중 인증' : '다시 오신 것을 환영합니다'}
                </h1>
                <p className="text-lg text-gray-600 mb-6 max-w-md mx-auto leading-relaxed">
                    {state.showTwoFactor ? '인증 앱에서 생성된 6자리 코드를 입력해주세요' : '좋아하는 작가들의 새로운 글이 기다리고 있어요'}
                </p>
            </div>

            {/* Main Login Card */}
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 p-8 space-y-8">
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
                <div className="text-center space-y-5 pt-6 border-t border-gray-100">
                    {!state.showTwoFactor && (
                        <p className="text-base text-gray-600">
                            아직 독자가 아니신가요?
                            <a href={`/sign${nextUrl ? '?next=' + encodeURIComponent(nextUrl) : ''}`} className="font-bold text-gray-900 hover:text-gray-700 transition-colors duration-200 ml-1 underline decoration-2 underline-offset-2">
                                가입하기
                            </a>
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Login;
