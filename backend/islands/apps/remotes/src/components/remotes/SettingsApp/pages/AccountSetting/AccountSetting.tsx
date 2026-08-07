import { useState } from 'react';
import { useLingui } from '@lingui/react/macro';
import { UserRound } from '@blex/ui/icons';
import { toast } from '~/utils/toast';
import { useSuspenseQuery } from '@tanstack/react-query';
import { useConfirm } from '~/hooks/useConfirm';
import { SettingsHeader } from '../../components';
import { Card } from '~/components/shared';
import { getAccountSettings, updateAccountSettings, deleteAccount } from '~/lib/api/settings';
import { enable2FA, disable2FA, verify2FASetup } from '~/lib/api/auth';
import AccountInfoSection from './components/AccountInfoSection';
import UsernameSection from './components/UsernameSection';
import NameSection from './components/NameSection';
import PasswordSection from './components/PasswordSection';
import SecuritySection from './components/SecuritySection';
import TwoFactorModal from './components/TwoFactorModal';
import type { AccountFormSubmitResult } from './types';

const AccountSettings = () => {
    const { t } = useLingui();
    const [isUsernameLoading, setIsUsernameLoading] = useState(false);
    const [isNameLoading, setIsNameLoading] = useState(false);
    const [isPasswordLoading, setIsPasswordLoading] = useState(false);
    const [showQRModal, setShowQRModal] = useState(false);
    const [qrCode, setQrCode] = useState<string>('');
    const [recoveryKey, setRecoveryKey] = useState<string>('');
    const { confirm } = useConfirm();
    const networkErrorMessage = t({
        id: 'common.network_error',
        message: 'A network error occurred.'
    });

    const { data: accountData, refetch } = useSuspenseQuery({
        queryKey: ['account-setting'],
        queryFn: async () => {
            const { data } = await getAccountSettings();
            if (data.status === 'DONE') {
                return data.body;
            }
            throw new Error(t({
                id: 'settings.account.load_failed',
                message: 'Could not load account information.'
            }));
        }
    });

    const handleUsernameSubmit = async (username: string): Promise<AccountFormSubmitResult> => {
        if (username === accountData?.username) {
            const error = t({
                id: 'settings.account.username.different_required',
                message: 'Enter a different username.'
            });
            toast.error(error);
            return {
                success: false,
                error
            };
        }

        const confirmed = await confirm({
            title: t({
                id: 'settings.account.username.confirm_title',
                message: 'Change username'
            }),
            message: t({
                id: 'settings.account.username.confirm_message',
                message: 'Change your username? If you have published posts, you can change it only once every six months.'
            }),
            confirmText: t({
                id: 'common.change',
                message: 'Change'
            })
        });

        if (!confirmed) return { success: false };

        setIsUsernameLoading(true);
        try {
            const { data } = await updateAccountSettings({ username });

            if (data.status === 'DONE') {
                toast.success(t({
                    id: 'settings.account.username.update_success',
                    message: 'Username changed.'
                }));
                void refetch();
                return { success: true };
            } else {
                const error = data.errorMessage || t({
                    id: 'settings.account.username.update_failed',
                    message: 'Could not change the username.'
                });
                toast.error(error);
                return {
                    success: false,
                    error
                };
            }
        } catch {
            const error = networkErrorMessage;
            toast.error(error);
            return {
                success: false,
                error
            };
        } finally {
            setIsUsernameLoading(false);
        }
    };

    const handleNameSubmit = async (name: string): Promise<AccountFormSubmitResult> => {
        setIsNameLoading(true);
        try {
            const { data } = await updateAccountSettings({ name });

            if (data.status === 'DONE') {
                toast.success(t({
                    id: 'settings.account.name.update_success',
                    message: 'Name updated.'
                }));
                void refetch();
                return { success: true };
            } else {
                const error = data.errorMessage || t({
                    id: 'settings.account.name.update_failed',
                    message: 'Could not update the name.'
                });
                toast.error(error);
                return {
                    success: false,
                    error
                };
            }
        } catch {
            const error = networkErrorMessage;
            toast.error(error);
            return {
                success: false,
                error
            };
        } finally {
            setIsNameLoading(false);
        }
    };

    const handlePasswordSubmit = async (password: string): Promise<AccountFormSubmitResult> => {
        setIsPasswordLoading(true);
        try {
            const { data } = await updateAccountSettings({ password });

            if (data.status === 'DONE') {
                toast.success(t({
                    id: 'settings.account.password.update_success',
                    message: 'Password changed.'
                }));
                void refetch();
                return { success: true };
            } else {
                const error = data.errorMessage || t({
                    id: 'settings.account.password.update_failed',
                    message: 'Could not change the password.'
                });
                toast.error(error);
                return {
                    success: false,
                    error
                };
            }
        } catch {
            const error = networkErrorMessage;
            toast.error(error);
            return {
                success: false,
                error
            };
        } finally {
            setIsPasswordLoading(false);
        }
    };

    const handle2FA = async (enable: boolean) => {
        if (!enable) {
            const confirmed = await confirm({
                title: t({
                    id: 'settings.account.two_factor.disable_title',
                    message: 'Disable two-factor authentication'
                }),
                message: t({
                    id: 'settings.account.two_factor.disable_confirm',
                    message: 'Disable two-factor authentication?'
                }),
                confirmText: t({
                    id: 'common.disable',
                    message: 'Disable'
                }),
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
                    const errorMsg = data.errorMessage || t({
                        id: 'settings.account.two_factor.enable_failed',
                        message: 'Could not enable two-factor authentication.'
                    });
                    toast.error(errorMsg);
                }
            } else {
                const { data } = await disable2FA();

                if (data.status === 'DONE') {
                    toast.success(t({
                        id: 'settings.account.two_factor.disable_success',
                        message: 'Two-factor authentication disabled.'
                    }));
                    setTimeout(() => location.reload(), 1000);
                } else {
                    const errorMsg = data.errorMessage || t({
                        id: 'settings.account.two_factor.disable_failed',
                        message: 'Could not disable two-factor authentication.'
                    });
                    toast.error(errorMsg);
                }
            }
        } catch {

            toast.error(networkErrorMessage);
        }
    };

    const handleVerify2FA = async (code: string) => {
        try {
            const { data } = await verify2FASetup(code);

            if (data.status === 'DONE') {
                toast.success(t({
                    id: 'settings.account.two_factor.enable_success',
                    message: 'Two-factor authentication enabled.'
                }));
                setShowQRModal(false);
                setTimeout(() => location.reload(), 1000);
                return { success: true };
            } else {
                return {
                    success: false,
                    error: data.errorMessage || t({
                        id: 'settings.account.two_factor.invalid_code',
                        message: 'The verification code is incorrect.'
                    })
                };
            }
        } catch {

            return {
                success: false,
                error: networkErrorMessage
            };
        }
    };

    const handleDeleteAccount = async () => {
        const confirmed = await confirm({
            title: t({
                id: 'settings.account.delete.title',
                message: 'Delete account'
            }),
            message: t({
                id: 'settings.account.delete.confirm',
                message: 'Delete your account? All data will be permanently deleted and cannot be recovered.'
            }),
            confirmText: t({
                id: 'common.delete',
                message: 'Delete'
            }),
            variant: 'danger'
        });

        if (!confirmed) return;

        try {
            const { data } = await deleteAccount();

            if (data.status === 'DONE') {
                toast.success(t({
                    id: 'settings.account.delete.success',
                    message: 'Account deleted.'
                }));

                // Use configured redirect URL from site settings, or fallback to home page
                const redirectUrl = accountData?.accountDeletionRedirectUrl || '/';

                setTimeout(() => {
                    window.location.assign(redirectUrl);
                }, 1500);
            } else {
                toast.error(data.errorMessage || t({
                    id: 'settings.account.delete.failed',
                    message: 'Could not delete the account.'
                }));
            }
        } catch {
            toast.error(networkErrorMessage);
        }
    };

    return (
        <div>
            <SettingsHeader
                title={t({
                    id: 'settings.account.title',
                    message: 'Account'
                })}
            />

            {/* Account Info */}
            <AccountInfoSection
                createdDate={accountData?.createdDate || ''}
                email={accountData?.email || ''}
            />

            {/* Basic Info */}
            <Card
                title={t({
                    id: 'settings.account.basic_info.title',
                    message: 'Basic information'
                })}
                icon={<UserRound className="h-5 w-5" />}
                className="mb-6">
                <div className="divide-y divide-line">
                    <UsernameSection
                        initialUsername={accountData?.username || ''}
                        isLoading={isUsernameLoading}
                        onSubmit={handleUsernameSubmit}
                    />
                    <NameSection
                        initialName={accountData?.name || ''}
                        isLoading={isNameLoading}
                        onSubmit={handleNameSubmit}
                    />
                </div>
            </Card>

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
