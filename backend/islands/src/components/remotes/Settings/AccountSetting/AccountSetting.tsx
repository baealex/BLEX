import { useState, useEffect } from 'react';
import { notification } from '@baejino/ui';
import { useQuery } from '@tanstack/react-query';
import { useConfirm } from '~/contexts/ConfirmContext';
import { getAccountSettings, updateAccountSettings, deleteAccount } from '~/lib/api/settings';
import { enable2FA, disable2FA, verify2FASetup } from '~/lib/api/auth';
import AccountInfoSection from './components/AccountInfoSection';
import UsernameSection from './components/UsernameSection';
import NameSection from './components/NameSection';
import PasswordSection from './components/PasswordSection';
import SecuritySection from './components/SecuritySection';
import TwoFactorModal from './components/TwoFactorModal';

const AccountSettings: React.FC = () => {
    const [isUsernameLoading, setIsUsernameLoading] = useState(false);
    const [isNameLoading, setIsNameLoading] = useState(false);
    const [isPasswordLoading, setIsPasswordLoading] = useState(false);
    const [showQRModal, setShowQRModal] = useState(false);
    const [qrCode, setQrCode] = useState<string>('');
    const [recoveryKey, setRecoveryKey] = useState<string>('');
    const { confirm } = useConfirm();

    const { data: accountData, isLoading: isDataLoading, isError, refetch } = useQuery({
        queryKey: ['account-setting'],
        queryFn: async () => {
            const { data } = await getAccountSettings();
            if (data.status === 'DONE') {
                return data.body;
            }
            throw new Error('계정 정보를 불러오는데 실패했습니다.');
        }
    });

    useEffect(() => {
        if (isError) {
            notification('계정 정보를 불러오는데 실패했습니다.', { type: 'error' });
        }
    }, [isError]);

    const handleUsernameSubmit = async (username: string) => {
        setIsUsernameLoading(true);
        try {
            const { data } = await updateAccountSettings({ username });

            if (data.status === 'DONE') {
                notification('아이디가 변경되었습니다.', { type: 'success' });
                refetch();
            } else {
                notification(data.errorMessage || '아이디 변경에 실패했습니다.', { type: 'error' });
            }
        } catch {
            notification('네트워크 오류가 발생했습니다.', { type: 'error' });
        } finally {
            setIsUsernameLoading(false);
        }
    };

    const handleNameSubmit = async (name: string) => {
        setIsNameLoading(true);
        try {
            const { data } = await updateAccountSettings({ name });

            if (data.status === 'DONE') {
                notification('이름이 업데이트되었습니다.', { type: 'success' });
                refetch();
            } else {
                notification(data.errorMessage || '이름 업데이트에 실패했습니다.', { type: 'error' });
            }
        } catch {
            notification('네트워크 오류가 발생했습니다.', { type: 'error' });
        } finally {
            setIsNameLoading(false);
        }
    };

    const handlePasswordSubmit = async (password: string) => {
        setIsPasswordLoading(true);
        try {
            const { data } = await updateAccountSettings({ new_password: password });

            if (data.status === 'DONE') {
                notification('비밀번호가 변경되었습니다.', { type: 'success' });
                refetch();
            } else {
                notification(data.errorMessage || '비밀번호 변경에 실패했습니다.', { type: 'error' });
            }
        } catch {
            notification('네트워크 오류가 발생했습니다.', { type: 'error' });
        } finally {
            setIsPasswordLoading(false);
        }
    };

    const handle2FA = async (enable: boolean) => {
        if (!enable) {
            const confirmed = await confirm({
                title: '2차 인증 해제',
                message: '정말 2차 인증을 해제할까요?',
                confirmText: '해제',
                variant: 'warning'
            });

            if (!confirmed) return;
        }

        try {
            if (enable) {
                const { data } = await enable2FA();

                if (data.status === 'DONE') {
                    setQrCode(data.body.qrCode);
                    setRecoveryKey(data.body.recoveryKey);
                    setShowQRModal(true);
                } else {
                    const errorMsg = data.errorMessage || '2차 인증 활성화에 실패했습니다.';
                    notification(errorMsg, { type: 'error' });
                }
            } else {
                const { data } = await disable2FA();

                if (data.status === 'DONE') {
                    notification('2차 인증이 해제되었습니다.', { type: 'success' });
                    setTimeout(() => location.reload(), 1000);
                } else {
                    const errorMsg = data.errorMessage || '2차 인증 해제에 실패했습니다.';
                    notification(errorMsg, { type: 'error' });
                }
            }
        } catch (error) {
            console.error('2FA Error:', error);
            notification('네트워크 오류가 발생했습니다.', { type: 'error' });
        }
    };

    const handleVerify2FA = async (code: string) => {
        try {
            const { data } = await verify2FASetup(code);

            if (data.status === 'DONE') {
                notification('2차 인증이 활성화되었습니다.', { type: 'success' });
                setShowQRModal(false);
                setTimeout(() => location.reload(), 1000);
                return { success: true };
            } else {
                return {
                    success: false,
                    error: data.errorMessage || '잘못된 인증 코드입니다.'
                };
            }
        } catch (error) {
            console.error('2FA Verification Error:', error);
            return {
                success: false,
                error: '네트워크 오류가 발생했습니다.'
            };
        }
    };

    const handleDeleteAccount = async () => {
        const confirmed = await confirm({
            title: '계정 삭제',
            message: '정말로 계정을 삭제하시겠습니까? 모든 데이터가 영구적으로 삭제되며 복구할 수 없습니다.',
            confirmText: '삭제',
            variant: 'warning'
        });

        if (!confirmed) return;

        try {
            const { data } = await deleteAccount();

            if (data.status === 'DONE') {
                notification('계정이 삭제되었습니다.', { type: 'success' });

                // Use configured redirect URL from site settings, or fallback to home page
                const redirectUrl = accountData?.accountDeletionRedirectUrl || '/';

                setTimeout(() => {
                    window.location.href = redirectUrl;
                }, 1500);
            } else {
                notification(data.errorMessage || '계정 삭제에 실패했습니다.', { type: 'error' });
            }
        } catch {
            notification('네트워크 오류가 발생했습니다.', { type: 'error' });
        }
    };

    if (isDataLoading) {
        return null;
    }

    return (
        <div className="p-6 bg-white shadow-sm rounded-2xl border border-gray-200">
            {/* Header Section */}
            <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">계정 설정</h2>
                <p className="text-gray-600">아이디, 이름, 비밀번호 등 계정 정보를 관리하세요.</p>
            </div>

            {/* Account Info */}
            <AccountInfoSection
                createdDate={accountData?.createdDate || ''}
                email={accountData?.email || ''}
            />

            {/* Username */}
            <UsernameSection
                initialUsername={accountData?.username || ''}
                isLoading={isUsernameLoading}
                onSubmit={handleUsernameSubmit}
            />

            {/* Name */}
            <NameSection
                initialName={accountData?.name || ''}
                isLoading={isNameLoading}
                onSubmit={handleNameSubmit}
            />

            {/* Password */}
            <PasswordSection
                isLoading={isPasswordLoading}
                onSubmit={handlePasswordSubmit}
            />

            {/* Security */}
            <SecuritySection
                has2fa={accountData?.has2fa || false}
                onToggle2FA={handle2FA}
                onDeleteAccount={handleDeleteAccount}
            />

            {/* 2FA Modal */}
            <TwoFactorModal
                isOpen={showQRModal}
                qrCode={qrCode}
                recoveryKey={recoveryKey}
                onClose={() => setShowQRModal(false)}
                onVerify={handleVerify2FA}
            />
        </div>
    );
};

export default AccountSettings;
