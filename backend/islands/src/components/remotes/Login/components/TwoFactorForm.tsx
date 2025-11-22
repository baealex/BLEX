import React from 'react';
import TwoFactorCodeInput from './TwoFactorCodeInput';

interface TwoFactorFormProps {
    codes: string[];
    verificationError: string;
    successMessage: string;
    isTwoFactorLoading: boolean;
    onCodeChange: (index: number, value: string) => void;
    onKeyDown: (index: number, e: React.KeyboardEvent) => void;
    onPaste?: (pastedCode: string) => void;
    onSubmit: (e: React.FormEvent) => void;
    onGoBack: () => void;
}

const getCsrfToken = (): string => {
    const token = document.querySelector<HTMLInputElement>('[name=csrfmiddlewaretoken]')?.value;
    return token || '';
};

const TwoFactorForm: React.FC<TwoFactorFormProps> = ({
    codes,
    verificationError,
    successMessage,
    isTwoFactorLoading,
    onCodeChange,
    onKeyDown,
    onPaste,
    onSubmit,
    onGoBack
}) => {
    return (
        <>
            {/* 2FA Header */}
            <div className="text-center">
                <div className="mx-auto h-12 w-12 bg-gradient-to-br from-gray-500 to-gray-500 rounded-xl flex items-center justify-center mb-4">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">이중 인증</h3>
                <p className="text-sm text-gray-600">
                    인증 앱에서 생성된 6자리 코드를 입력하세요
                </p>
            </div>

            {/* Verification Code Form */}
            <form className="space-y-6" onSubmit={onSubmit}>
                <input type="hidden" name="csrfmiddlewaretoken" value={getCsrfToken()} />

                <TwoFactorCodeInput
                    codes={codes}
                    onCodeChange={onCodeChange}
                    onKeyDown={onKeyDown}
                    onPaste={onPaste}
                    autoFocus={true}
                />

                {/* Back to login button */}
                <div className="text-center">
                    <button
                        type="button"
                        onClick={onGoBack}
                        className="text-sm text-gray-500 hover:text-gray-700 transition-colors">
                        ← 로그인 화면으로 돌아가기
                    </button>
                </div>

                {/* Error Message */}
                {verificationError && (
                    <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                        <p className="text-gray-700 text-sm font-medium text-center">{verificationError}</p>
                    </div>
                )}

                {/* Success Message */}
                {successMessage && (
                    <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                        <p className="text-gray-700 text-sm font-medium text-center">{successMessage}</p>
                    </div>
                )}

                {/* Action Buttons */}
                <div className="space-y-4">
                    <button
                        type="submit"
                        disabled={isTwoFactorLoading}
                        className="w-full flex items-center justify-center py-3 px-6 bg-gradient-to-r from-gray-600 to-gray-600 hover:from-gray-700 hover:to-gray-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none">
                        {isTwoFactorLoading && (
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
                        <span>{isTwoFactorLoading ? '인증 중...' : '인증하기'}</span>
                    </button>
                </div>
            </form>
        </>
    );
};

export default TwoFactorForm;
