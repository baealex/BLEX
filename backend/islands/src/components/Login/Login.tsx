import React from 'react';
import { useLoginState } from './hooks/useLoginState';
import LoginForm from './components/LoginForm';
import TwoFactorForm from './components/TwoFactorForm';

const getCsrfToken = (): string => {
    const token = document.querySelector<HTMLInputElement>('[name=csrfmiddlewaretoken]')?.value;
    return token || '';
};

const Login = () => {
    const {
        state,
        updateState,
        goBackToLogin,
        checkIfBlocked,
        handleFailedLogin,
        handleFailedTwoFactor
    } = useLoginState();

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

    const handleCodeInput = (index: number, value: string) => {
        const newCodes = [...state.codes];

        // Handle pasted content (6-digit code)
        if (value.length > 1) {
            const pastedCode = value.replace(/\D/g, '').slice(0, 6);
            if (pastedCode.length === 6) {
                for (let i = 0; i < 6; i++) {
                    newCodes[i] = pastedCode[i] || '';
                }
                updateState({
                    codes: newCodes,
                    verificationError: '',
                    successMessage: ''
                });
                const lastIndex = Math.min(5, pastedCode.length - 1);
                setTimeout(() => {
                    const inputs = document.querySelectorAll('input[inputmode="numeric"]');
                    (inputs[lastIndex] as HTMLInputElement)?.focus();
                }, 0);
                return;
            }
        }

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
        } else if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
            e.preventDefault();
            navigator.clipboard.readText().then(text => {
                const pastedCode = text.replace(/\D/g, '').slice(0, 6);
                if (pastedCode.length === 6) {
                    const newCodes = ['', '', '', '', '', ''];
                    for (let i = 0; i < 6; i++) {
                        newCodes[i] = pastedCode[i] || '';
                    }
                    updateState({
                        codes: newCodes,
                        verificationError: '',
                        successMessage: ''
                    });
                    setTimeout(() => {
                        const inputs = document.querySelectorAll('input[inputmode="numeric"]');
                        (inputs[5] as HTMLInputElement)?.focus();
                    }, 0);
                }
            }).catch(() => {
                // Fallback if clipboard access fails
            });
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
            const requestBody = new URLSearchParams({
                'username': state.username,
                'password': state.password
            });

            if (state.captchaToken) {
                requestBody.append('h-captcha-response', state.captchaToken);
            }

            const response = await fetch('/v1/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'X-CSRFToken': getCsrfToken()
                },
                body: requestBody
            });
            const data = await response.json();

            if (data.status === 'DONE') {
                updateState({
                    failedAttempts: 0,
                    showCaptcha: false,
                    captchaToken: null
                });

                if (data.body.security) {
                    updateState({ showTwoFactor: true });
                } else {
                    window.location.href = '/';
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
            const response = await fetch('/v1/auth/security', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'X-CSRFToken': getCsrfToken()
                },
                body: new URLSearchParams({ 'code': code })
            });
            const data = await response.json();

            if (data.status === 'DONE') {
                updateState({
                    twoFactorFailedAttempts: 0,
                    successMessage: '인증이 완료되었습니다. 잠시 후 홈 페이지로 이동합니다.'
                });
                setTimeout(() => {
                    window.location.href = '/';
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
                <div className="mx-auto h-16 w-16 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center mb-6 shadow-lg">
                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                </div>
                <h1 className="text-3xl font-bold text-slate-900 mb-2">
                    {state.showTwoFactor ? '이중 인증' : '다시 오신 것을 환영합니다'}
                </h1>
                <p className="text-slate-600">
                    {state.showTwoFactor ? '텔레그램으로 전송된 인증 코드를 입력해주세요' : 'BLEX에서 새로운 아이디어를 발견해보세요'}
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
                        onUsernameChange={(value) => updateState({ username: value })}
                        onPasswordChange={(value) => updateState({ password: value })}
                        onSubmit={submitForm}
                    />
                ) : (
                    <TwoFactorForm
                        codes={state.codes}
                        verificationError={state.verificationError}
                        successMessage={state.successMessage}
                        isTwoFactorLoading={state.isTwoFactorLoading}
                        isResending={state.isResending}
                        onCodeChange={handleCodeInput}
                        onKeyDown={handleCodeKeyDown}
                        onSubmit={submitTwoFactor}
                        onGoBack={goBackToLogin}
                    />
                )}

                {/* Footer Links */}
                <div className="text-center space-y-4 pt-4 border-t border-slate-200">
                    {!state.showTwoFactor && (
                        <p className="text-slate-600">
                            계정이 없으신가요?
                            <a href="/sign" className="font-semibold text-blue-600 hover:text-blue-800 transition-colors duration-200 ml-1">
                                회원가입하기
                            </a>
                        </p>
                    )}
                    <div className="flex items-center justify-center space-x-6 text-sm text-slate-500">
                        <a href="/about" className="hover:text-slate-700 transition-colors">서비스 소개</a>
                        <a href="/privacy" className="hover:text-slate-700 transition-colors">개인정보처리방침</a>
                        <a href="/terms" className="hover:text-slate-700 transition-colors">이용약관</a>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Login;
