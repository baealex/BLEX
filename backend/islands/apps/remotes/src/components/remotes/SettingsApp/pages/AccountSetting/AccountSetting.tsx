import { useState } from 'react';
import { toast } from '~/utils/toast';
import { useSuspenseQuery } from '@tanstack/react-query';
import { useConfirm } from '~/contexts/ConfirmContext';
import { SettingsHeader } from '../../components';
import { getAccountSettings, updateAccountSettings, deleteAccount } from '~/lib/api/settings';
import { enable2FA, disable2FA, verify2FASetup } from '~/lib/api/auth';
import AccountInfoSection from './components/AccountInfoSection';
import UsernameSection from './components/UsernameSection';
import NameSection from './components/NameSection';
import PasswordSection from './components/PasswordSection';
import SecuritySection from './components/SecuritySection';
import TwoFactorModal from './components/TwoFactorModal';

const AccountSettings = () => {
    const [isUsernameLoading, setIsUsernameLoading] = useState(false);
    const [isNameLoading, setIsNameLoading] = useState(false);
    const [isPasswordLoading, setIsPasswordLoading] = useState(false);
    const [showQRModal, setShowQRModal] = useState(false);
    const [qrCode, setQrCode] = useState<string>('');
    const [recoveryKey, setRecoveryKey] = useState<string>('');
    const { confirm } = useConfirm();

    const { data: accountData, refetch } = useSuspenseQuery({
        queryKey: ['account-setting'],
        queryFn: async () => {
            const { data } = await getAccountSettings();
            if (data.status === 'DONE') {
                return data.body;
            }
            throw new Error('계정 정보를 불러오는데 실패했습니다.');
        }
    });

    const handleUsernameSubmit = async (username: string) => {
        if (username === accountData?.username) {
            toast.error('변경할 아이디를 입력해주세요.');
            return;
        }

        const confirmed = await confirm({
            title: '사용자 필명 변경',
            message: '사용자 필명을 변경하시겠습니까? 작성한 포스트가 존재하는 경우 6개월에 한번만 변경할 수 있습니다.',
            confirmText: '변경'
        });

        if (!confirmed) return;

        setIsUsernameLoading(true);
        try {
            const { data } = await updateAccountSettings({ username });

            if (data.status === 'DONE') {
                toast.success('아이디가 변경되었습니다.');
                refetch();
            } else {
                toast.error(data.errorMessage || '아이디 변경에 실패했습니다.');
            }
        } catch {
            toast.error('네트워크 오류가 발생했습니다.');
        } finally {
            setIsUsernameLoading(false);
        }
    };

    const handleNameSubmit = async (name: string) => {
        setIsNameLoading(true);
        try {
            const { data } = await updateAccountSettings({ name });

            if (data.status === 'DONE') {
                toast.success('이름이 업데이트되었습니다.');
                refetch();
            } else {
                toast.error(data.errorMessage || '이름 업데이트에 실패했습니다.');
            }
        } catch {
            toast.error('네트워크 오류가 발생했습니다.');
        } finally {
            setIsNameLoading(false);
        }
    };

    const handlePasswordSubmit = async (password: string) => {
        setIsPasswordLoading(true);
        try {
            const { data } = await updateAccountSettings({ new_password: password });

            if (data.status === 'DONE') {
                toast.success('비밀번호가 변경되었습니다.');
                refetch();
            } else {
                toast.error(data.errorMessage || '비밀번호 변경에 실패했습니다.');
            }
        } catch {
            toast.error('네트워크 오류가 발생했습니다.');
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
                variant: 'danger'
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
                    toast.error(errorMsg);
                }
            } else {
                const { data } = await disable2FA();

                if (data.status === 'DONE') {
                    toast.success('2차 인증이 해제되었습니다.');
                    setTimeout(() => location.reload(), 1000);
                } else {
                    const errorMsg = data.errorMessage || '2차 인증 해제에 실패했습니다.';
                    toast.error(errorMsg);
                }
            }
        } catch {

            toast.error('네트워크 오류가 발생했습니다.');
        }
    };

    const handleVerify2FA = async (code: string) => {
        try {
            const { data } = await verify2FASetup(code);

            if (data.status === 'DONE') {
                toast.success('2차 인증이 활성화되었습니다.');
                setShowQRModal(false);
                setTimeout(() => location.reload(), 1000);
                return { success: true };
            } else {
                return {
                    success: false,
                    error: data.errorMessage || '잘못된 인증 코드입니다.'
                };
            }
        } catch {

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
            variant: 'danger'
        });

        if (!confirmed) return;

        try {
            const { data } = await deleteAccount();

            if (data.status === 'DONE') {
                toast.success('계정이 삭제되었습니다.');

                // Use configured redirect URL from site settings, or fallback to home page
                const redirectUrl = accountData?.accountDeletionRedirectUrl || '/';

                setTimeout(() => {
                    window.location.href = redirectUrl;
                }, 1500);
            } else {
                toast.error(data.errorMessage || '계정 삭제에 실패했습니다.');
            }
        } catch {
            toast.error('네트워크 오류가 발생했습니다.');
        }
    };

    return (
        <div>
            <SettingsHeader
                title="계정 설정"
                description="아이디, 이름, 비밀번호 등 계정 정보를 관리하세요."
            />

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
