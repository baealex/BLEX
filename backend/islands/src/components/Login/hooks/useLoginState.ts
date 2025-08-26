import { useState } from 'react';

export interface LoginState {
    // Login step
    username: string;
    password: string;
    usernameError: string;
    passwordError: string;
    loginError: string;
    isLoading: boolean;

    // 2FA step
    showTwoFactor: boolean;
    codes: string[];
    verificationError: string;
    successMessage: string;
    isTwoFactorLoading: boolean;
    isResending: boolean;

    // Security features
    failedAttempts: number;
    isBlocked: boolean;
    blockEndTime: number | null;
    showCaptcha: boolean;
    captchaToken: string | null;
    twoFactorFailedAttempts: number;
}

export const useLoginState = () => {
    const [state, setState] = useState<LoginState>({
        username: '',
        password: '',
        usernameError: '',
        passwordError: '',
        loginError: '',
        isLoading: false,
        showTwoFactor: false,
        codes: ['', '', '', '', '', ''],
        verificationError: '',
        successMessage: '',
        isTwoFactorLoading: false,
        isResending: false,
        failedAttempts: 0,
        isBlocked: false,
        blockEndTime: null,
        showCaptcha: false,
        captchaToken: null,
        twoFactorFailedAttempts: 0
    });

    const updateState = (updates: Partial<LoginState>) => {
        setState(prev => ({
            ...prev,
            ...updates
        }));
    };

    const goBackToLogin = () => {
        updateState({
            showTwoFactor: false,
            codes: ['', '', '', '', '', ''],
            verificationError: '',
            successMessage: '',
            twoFactorFailedAttempts: 0
        });
    };

    const checkIfBlocked = (): boolean => {
        if (state.blockEndTime && Date.now() < state.blockEndTime) {
            const remainingTime = Math.ceil((state.blockEndTime - Date.now()) / 1000);
            updateState({
                loginError: `너무 많은 시도로 인해 ${remainingTime}초 동안 차단되었습니다.`,
                isBlocked: true
            });
            return true;
        }
        updateState({ isBlocked: false });
        return false;
    };

    const handleFailedLogin = () => {
        const newFailedAttempts = state.failedAttempts + 1;

        const updates: Partial<LoginState> = { failedAttempts: newFailedAttempts };

        if (newFailedAttempts >= 3) {
            updates.showCaptcha = true;
        }

        if (newFailedAttempts >= 5) {
            const delays = [30000, 60000, 120000, 300000, 600000];
            const delayIndex = Math.min(newFailedAttempts - 5, delays.length - 1);
            const blockEndTime = Date.now() + delays[delayIndex];
            const delaySeconds = Math.ceil(delays[delayIndex] / 1000);

            updates.blockEndTime = blockEndTime;
            updates.isBlocked = true;
            updates.loginError = `너무 많은 실패로 인해 ${delaySeconds}초 동안 차단되었습니다.`;
        }

        updateState(updates);
    };

    const handleFailedTwoFactor = (): boolean => {
        const newTwoFactorFailedAttempts = state.twoFactorFailedAttempts + 1;

        if (newTwoFactorFailedAttempts >= 5) {
            updateState({
                blockEndTime: Date.now() + 300000,
                verificationError: '너무 많은 실패로 인해 5분 동안 차단되었습니다.',
                showTwoFactor: false
            });
            goBackToLogin();
            return true;
        }

        if (newTwoFactorFailedAttempts >= 3) {
            updateState({
                isTwoFactorLoading: true,
                twoFactorFailedAttempts: newTwoFactorFailedAttempts
            });
            setTimeout(() => {
                updateState({ isTwoFactorLoading: false });
            }, 3000);
        } else {
            updateState({ twoFactorFailedAttempts: newTwoFactorFailedAttempts });
        }

        return false;
    };

    return {
        state,
        updateState,
        goBackToLogin,
        checkIfBlocked,
        handleFailedLogin,
        handleFailedTwoFactor
    };
};