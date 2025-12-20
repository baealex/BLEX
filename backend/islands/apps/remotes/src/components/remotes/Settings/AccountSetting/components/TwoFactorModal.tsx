import { useState } from 'react';
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
    const [verificationCode, setVerificationCode] = useState('');
    const [isVerifying, setIsVerifying] = useState(false);
    const [verificationError, setVerificationError] = useState('');

    const handleVerify = async () => {
        if (!verificationCode || verificationCode.length !== 6) {
            setVerificationError('올바른 6자리 코드를 입력해주세요.');
            return;
        }

        setIsVerifying(true);
        setVerificationError('');

        const result = await onVerify(verificationCode);

        if (!result.success) {
            setVerificationError(result.error || '잘못된 인증 코드입니다.');
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
            title="2차 인증 설정">
            <div className="p-6 space-y-4">
                <div>
                    <p className="text-sm text-gray-600 mb-3">
                        인증 앱(Google Authenticator, Authy 등)으로 아래 QR 코드를 스캔하세요.
                    </p>
                    <div className="flex justify-center bg-white p-4 rounded-lg border border-gray-200">
                        <img src={qrCode} alt="QR Code" className="w-48 h-48" />
                    </div>
                </div>

                <div>
                    <p className="text-sm font-medium text-gray-900 mb-2">복구 키</p>
                    <p className="text-xs text-gray-600 mb-2">
                        기기를 분실했을 때 이 키로 로그인할 수 있습니다. 안전한 곳에 보관하세요.
                    </p>
                    <div className="bg-gray-50 p-3 rounded-md border border-gray-200">
                        <code className="text-sm font-mono text-gray-900 break-all">{recoveryKey}</code>
                    </div>
                </div>

                <Alert variant="warning">
                    복구 키를 잃어버리면 기기 분실 시 계정에 접근할 수 없습니다.
                </Alert>

                <div>
                    <label className="block text-sm font-medium text-gray-900 mb-2">
                        인증 앱에 표시된 6자리 코드를 입력하세요
                    </label>
                    <Input
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
                        variant="secondary"
                        size="md"
                        fullWidth
                        onClick={handleClose}>
                        취소
                    </Button>
                    <Button
                        variant="primary"
                        size="md"
                        fullWidth
                        isLoading={isVerifying}
                        onClick={handleVerify}>
                        {isVerifying ? '확인 중...' : '인증'}
                    </Button>
                </div>
            </div>
        </Modal>
    );
};

export default TwoFactorModal;
