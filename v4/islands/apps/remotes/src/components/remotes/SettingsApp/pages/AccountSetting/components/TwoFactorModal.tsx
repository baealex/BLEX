import { useState } from 'react';
import { Trans, useLingui } from '@lingui/react/macro';
import { Button, Input, Modal, Alert } from '~/components/shared';

interface TwoFactorModalProps {
    isOpen: boolean;
    qrCode: string;
    recoveryKey: string;
    onClose: () => void;
    onVerify: (code: string) => Promise<{ success: boolean; error?: string }>;
}

const TwoFactorModal = ({
    isOpen,
    qrCode,
    recoveryKey,
    onClose,
    onVerify
}: TwoFactorModalProps) => {
    const { t } = useLingui();
    const [verificationCode, setVerificationCode] = useState('');
    const [isVerifying, setIsVerifying] = useState(false);
    const [verificationError, setVerificationError] = useState('');

    const handleVerify = async () => {
        if (!verificationCode || verificationCode.length !== 6) {
            setVerificationError(t({
                id: 'settings.account.two_factor.validation.six_digits',
                message: 'Enter a valid 6-digit code.'
            }));
            return;
        }

        setIsVerifying(true);
        setVerificationError('');

        const result = await onVerify(verificationCode);

        if (!result.success) {
            setVerificationError(result.error || t({
                id: 'settings.account.two_factor.invalid_code',
                message: 'The verification code is incorrect.'
            }));
        }

        setIsVerifying(false);
    };

    const handleClose = () => {
        setVerificationCode('');
        setVerificationError('');
        onClose();
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={handleClose}
            maxWidth="sm"
            title={t({
                id: 'settings.account.two_factor.setup_title',
                message: 'Set up two-factor authentication'
            })}>
            <div className="p-6 space-y-4">
                <div>
                    <p className="text-sm text-content-secondary mb-3">
                        <Trans id="settings.account.two_factor.scan_qr">
                            Scan this QR code with an authenticator app such as Google Authenticator or Authy.
                        </Trans>
                    </p>
                    <div className="flex justify-center bg-surface p-4 rounded-lg border border-line">
                        <img
                            src={qrCode}
                            alt={t({
                                id: 'settings.account.two_factor.qr_code',
                                message: 'Two-factor authentication QR code'
                            })}
                            className="w-48 h-48"
                        />
                    </div>
                </div>

                <div>
                    <p className="text-sm font-medium text-content mb-2">
                        <Trans id="settings.account.two_factor.recovery_key">
                            Recovery key
                        </Trans>
                    </p>
                    <p className="text-xs text-content-secondary mb-2">
                        <Trans id="settings.account.two_factor.recovery_key_description">
                            You can use this key to sign in if you lose your device. Store it somewhere safe.
                        </Trans>
                    </p>
                    <div className="bg-surface-subtle p-3 rounded-md border border-line">
                        <code className="text-sm font-mono text-content break-all">{recoveryKey}</code>
                    </div>
                </div>

                <Alert variant="warning">
                    <Trans id="settings.account.two_factor.recovery_key_warning">
                        If you lose both your device and recovery key, you will not be able to access your account.
                    </Trans>
                </Alert>

                <div>
                    <label htmlFor="two-factor-verification-code" className="block text-sm font-medium text-content mb-2">
                        <Trans id="settings.account.two_factor.code_label">
                            Enter the 6-digit code from your authenticator app
                        </Trans>
                    </label>
                    <Input
                        density="compact"
                        id="two-factor-verification-code"
                        type="text"
                        placeholder="000000"
                        maxLength={6}
                        value={verificationCode}
                        onChange={(e) => {
                            const value = e.target.value.replace(/\D/g, '');
                            setVerificationCode(value);
                            setVerificationError('');
                        }}
                        error={verificationError}
                    />
                </div>

                <div className="flex gap-3">
                    <Button
                        density="compact"
                        variant="secondary"
                        size="md"
                        className="min-h-11! [@media(pointer:fine)]:min-h-10!"
                        fullWidth
                        onClick={handleClose}>
                        <Trans id="common.cancel">Cancel</Trans>
                    </Button>
                    <Button
                        density="compact"
                        variant="primary"
                        size="md"
                        className="min-h-11! [@media(pointer:fine)]:min-h-10!"
                        fullWidth
                        isLoading={isVerifying}
                        onClick={handleVerify}>
                        {isVerifying
                            ? t({
                                id: 'settings.account.two_factor.verifying',
                                message: 'Verifying...'
                            })
                            : t({
                                id: 'settings.account.two_factor.verify',
                                message: 'Verify'
                            })}
                    </Button>
                </div>
            </div>
        </Modal>
    );
};

export default TwoFactorModal;
