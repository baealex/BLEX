import React, { useState } from 'react';
import { Trans } from '@lingui/react/macro';
import TwoFactorCodeInput from './TwoFactorCodeInput';
import {
    InlineIcon,
    ArrowLeft,
    AlertTriangle,
    CheckCircle,
    Loader2
} from '~/ui/icons';

interface TwoFactorFormProps {
    codes: string[];
    verificationError: string;
    successMessage: string;
    isTwoFactorLoading: boolean;
    onCodeChange: (index: number, value: string) => void;
    onKeyDown: (index: number, e: React.KeyboardEvent) => void;
    onPaste?: (pastedCode: string) => void;
    onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
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
    const [useRecoveryKey, setUseRecoveryKey] = useState(false);

    return (
        <>
            {/* Verification Code Form */}
            <form className="space-y-6" noValidate onSubmit={onSubmit}>
                <input type="hidden" name="csrfmiddlewaretoken" value={getCsrfToken()} />

                {useRecoveryKey ? (
                    <label className="block space-y-2 text-sm font-medium text-content">
                        <span><Trans id="auth.two_factor.recovery_key">Recovery key</Trans></span>
                        <input
                            name="recoveryKey"
                            type="password"
                            maxLength={64}
                            autoComplete="off"
                            spellCheck={false}
                            className="h-12 w-full rounded-lg border border-line bg-surface px-3 font-mono"
                        />
                    </label>
                ) : (
                    <TwoFactorCodeInput
                        codes={codes}
                        onCodeChange={onCodeChange}
                        onKeyDown={onKeyDown}
                        onPaste={onPaste}
                        autoFocus={true}
                    />
                )}

                {/* Back to login button */}
                <div className="flex flex-wrap justify-center gap-x-4">
                    <button
                        type="button"
                        onClick={() => setUseRecoveryKey((previous) => !previous)}
                        className="min-h-11 text-xs font-medium text-content-secondary hover:underline">
                        {useRecoveryKey ? (
                            <Trans id="auth.two_factor.use_authenticator">Use an authenticator code</Trans>
                        ) : (
                            <Trans id="auth.two_factor.use_recovery_key">Use a recovery key</Trans>
                        )}
                    </button>
                    <button
                        type="button"
                        onClick={onGoBack}
                        className="inline-flex min-h-11 items-center gap-1 text-xs font-medium text-content-secondary hover:underline">
                        <InlineIcon icon={ArrowLeft} />
                        <Trans id="auth.two_factor.back_to_login">Back to login</Trans>
                    </button>
                </div>

                {/* Error Message */}
                {verificationError && (
                    <div role="alert" className="bg-danger-surface border border-danger-line rounded-xl p-4 flex items-center gap-3">
                        <InlineIcon icon={AlertTriangle} className="text-danger" />
                        <p className="text-danger text-sm font-medium">{verificationError}</p>
                    </div>
                )}

                {/* Success Message */}
                {successMessage && (
                    <div role="status" className="bg-success-surface border border-success-line rounded-xl p-4 flex items-center gap-3">
                        <InlineIcon icon={CheckCircle} className="text-success" />
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
                            <Loader2 aria-hidden="true" className="animate-spin -ml-1 mr-2 h-4 w-4 text-content-inverted" />
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
