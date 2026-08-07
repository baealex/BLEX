import React from 'react';
import { Trans } from '@lingui/react/macro';
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

const TwoFactorForm = ({
    codes,
    verificationError,
    successMessage,
    isTwoFactorLoading,
    onCodeChange,
    onKeyDown,
    onPaste,
    onSubmit,
    onGoBack
}: TwoFactorFormProps) => {
    return (
        <>
            {/* Verification Code Form */}
            <form className="space-y-6" noValidate onSubmit={onSubmit}>
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
                        className="text-xs font-medium text-content-hint hover:text-content-secondary transition-colors flex items-center justify-center gap-1 mx-auto">
                        <i className="fas fa-arrow-left" />
                        <Trans id="auth.two_factor.back_to_login">Back to login</Trans>
                    </button>
                </div>

                {/* Error Message */}
                {verificationError && (
                    <div role="alert" className="bg-danger-surface border border-danger-line rounded-xl p-4 flex items-center gap-3">
                        <i aria-hidden="true" className="fas fa-exclamation-triangle text-danger" />
                        <p className="text-danger text-sm font-medium">{verificationError}</p>
                    </div>
                )}

                {/* Success Message */}
                {successMessage && (
                    <div role="status" className="bg-success-surface border border-success-line rounded-xl p-4 flex items-center gap-3">
                        <i aria-hidden="true" className="fas fa-check-circle text-success" />
                        <p className="text-success text-sm font-medium">{successMessage}</p>
                    </div>
                )}

                {/* Action Buttons */}
                <div className="space-y-4">
                    <button
                        type="submit"
                        disabled={isTwoFactorLoading}
                        className="w-full flex items-center justify-center py-3.5 px-6 bg-action hover:bg-action-hover text-content-inverted font-semibold rounded-2xl shadow-floating hover:shadow-floating hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none text-sm">
                        {isTwoFactorLoading && (
                            <svg
                                aria-hidden="true"
                                className="animate-spin -ml-1 mr-2 h-4 w-4 text-content-inverted"
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 24 24">
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
                        <span>
                            {isTwoFactorLoading ? (
                                <Trans id="auth.two_factor.verifying">Verifying...</Trans>
                            ) : (
                                <Trans id="auth.two_factor.verify">Verify</Trans>
                            )}
                        </span>
                    </button>
                </div>
            </form>
        </>
    );
};

export default TwoFactorForm;
