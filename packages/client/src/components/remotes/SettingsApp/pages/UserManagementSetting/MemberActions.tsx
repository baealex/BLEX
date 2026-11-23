import { useState } from 'react';
import { Trans, useLingui } from '@lingui/react/macro';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
 Copy, KeyRound, Lock, RotateCcw, Trash2
} from '~/ui/icons';
import { toast } from '~/utils/toast';
import { useConfirm } from '~/hooks/useConfirm';
import { Button, Input, Modal } from '~/components/shared';
import { getDocumentTimeZone, normalizeLocale } from '~/i18n/locale';
import {
    createManagedUserPasswordLink,
    deleteManagedUser,
    resetManagedUserTwoFactor,
    updateManagedUserStatus,
    type ManagedUser
} from '~/lib/api/settings';

interface ApiEnvelope {
    data: { status: string; errorMessage?: string };
}

export const MemberActions = ({ user }: { user: ManagedUser }) => {
    const { i18n, t } = useLingui();
    const { confirm } = useConfirm();
    const queryClient = useQueryClient();
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [confirmation, setConfirmation] = useState('');
    const [passwordLink, setPasswordLink] = useState<{ url: string; expiresDate: string } | null>(null);
    const failed = t({
        id: 'settings.users.actions.failed',
        message: 'Could not complete this action.'
    });
    const refresh = () => queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    const isDone = ({ data }: ApiEnvelope) => {
        if (data.status === 'DONE') return true;
        toast.error(data.errorMessage || failed);
        return false;
    };

    const statusMutation = useMutation({
        mutationFn: (isActive: boolean) => updateManagedUserStatus(user.id, isActive),
        onSuccess: (response, isActive) => {
            if (!isDone(response)) return;
            toast.success(isActive
                ? i18n._({
                    id: 'settings.users.actions.reactivated',
                    message: 'Reactivated {username}.',
                    values: { username: user.username }
                })
                : i18n._({
                    id: 'settings.users.actions.deactivated',
                    message: 'Deactivated {username}.',
                    values: { username: user.username }
                }));
            void refresh();
        },
        onError: () => toast.error(failed)
    });

    const twoFactorMutation = useMutation({
        mutationFn: () => resetManagedUserTwoFactor(user.id),
        onSuccess: (response) => {
            if (!isDone(response)) return;
            toast.success(i18n._({
                id: 'settings.users.actions.two_factor_reset',
                message: 'Turned off two-factor authentication for {username}.',
                values: { username: user.username }
            }));
            void refresh();
        },
        onError: () => toast.error(failed)
    });

    const passwordMutation = useMutation({
        mutationFn: () => createManagedUserPasswordLink(user.id),
        onSuccess: (response) => {
            if (!isDone(response) || response.data.status !== 'DONE') return;
            setPasswordLink(response.data.body);
        },
        onError: () => toast.error(failed)
    });

    const deleteMutation = useMutation({
        mutationFn: () => deleteManagedUser(user.id, confirmation),
        onSuccess: (response) => {
            if (!isDone(response)) return;
            toast.success(i18n._({
                id: 'settings.users.actions.deleted',
                message: 'Deleted {username}.',
                values: { username: user.username }
            }));
            setIsDeleteOpen(false);
            void refresh();
        },
        onError: () => toast.error(failed)
    });

    const handleStatus = async () => {
        const nextActive = !user.isActive;
        const confirmed = await confirm(nextActive
            ? {
                title: t({
                    id: 'settings.users.actions.reactivate_title',
                    message: 'Reactivate account'
                }),
                message: i18n._({
                    id: 'settings.users.actions.reactivate_message',
                    message: '{username} will be able to sign in again, and their public posts will return.',
                    values: { username: user.username }
                }),
                confirmText: t({
                    id: 'settings.users.actions.reactivate',
                    message: 'Reactivate'
                })
            }
            : {
                title: t({
                    id: 'settings.users.actions.deactivate_title',
                    message: 'Deactivate account'
                }),
                message: i18n._({
                    id: 'settings.users.actions.deactivate_message',
                    message: '{username} will be signed out and cannot sign in. Their posts are hidden from visitors. You can reactivate the account at any time.',
                    values: { username: user.username }
                }),
                confirmText: t({
                    id: 'settings.users.actions.deactivate',
                    message: 'Deactivate'
                }),
                variant: 'danger'
            });
        if (confirmed) statusMutation.mutate(nextActive);
    };

    const handleTwoFactor = async () => {
        const confirmed = await confirm({
            title: t({
                id: 'settings.users.actions.two_factor_title',
                message: 'Turn off two-factor authentication'
            }),
            message: i18n._({
                id: 'settings.users.actions.two_factor_message',
                message: 'Only do this after confirming the request came from {username}. They will be signed out and can sign in with just a password.',
                values: { username: user.username }
            }),
            confirmText: t({
                id: 'settings.users.actions.two_factor_confirm',
                message: 'Turn off'
            }),
            variant: 'danger'
        });
        if (confirmed) twoFactorMutation.mutate();
    };

    const handlePasswordLink = async () => {
        const confirmed = await confirm({
            title: t({
                id: 'settings.users.actions.password_title',
                message: 'Create password reset link'
            }),
            message: i18n._({
                id: 'settings.users.actions.password_message',
                message: 'Anyone with this link can set a new password for {username} for 24 hours. Only send it to the account owner.',
                values: { username: user.username }
            }),
            confirmText: t({
                id: 'settings.users.actions.password_confirm',
                message: 'Create link'
            })
        });
        if (confirmed) passwordMutation.mutate();
    };

    const handleCopyLink = async () => {
        if (!passwordLink) return;
        try {
            await navigator.clipboard.writeText(passwordLink.url);
            toast.success(t({
                id: 'settings.users.actions.password_copied',
                message: 'Password reset link copied.'
            }));
        } catch {
            toast.error(t({
                id: 'settings.users.actions.password_copy_failed',
                message: 'Could not copy the link. Select it and copy it manually.'
            }));
        }
    };

    if (!user.canChangeStatus && !user.canDelete && !user.canResetPassword && !user.canResetTwoFactor) return null;

    return (
        <div className="mt-4 border-t border-line pt-4 md:border-t-0">
            <p className="mb-2 text-xs font-medium text-content-hint">
                <Trans id="settings.users.field.actions">Actions</Trans>
            </p>
            <div className="flex flex-wrap gap-2">
                {user.canChangeStatus && (
                    <Button
                        density="compact"
                        size="sm"
                        variant="secondary"
                        isLoading={statusMutation.isPending}
                        onClick={() => void handleStatus()}>
                        {user.isActive
                            ? <Lock aria-hidden="true" className="h-4 w-4" />
                            : <RotateCcw aria-hidden="true" className="h-4 w-4" />}
                        {user.isActive
                            ? <Trans id="settings.users.actions.deactivate">Deactivate</Trans>
                            : <Trans id="settings.users.actions.reactivate">Reactivate</Trans>}
                    </Button>
                )}
                {user.canResetPassword && (
                    <Button
                        density="compact"
                        size="sm"
                        variant="secondary"
                        isLoading={passwordMutation.isPending}
                        onClick={() => void handlePasswordLink()}>
                        <KeyRound aria-hidden="true" className="h-4 w-4" />
                        <Trans id="settings.users.actions.password_action">Password reset link</Trans>
                    </Button>
                )}
                {user.canResetTwoFactor && (
                    <Button
                        density="compact"
                        size="sm"
                        variant="secondary"
                        isLoading={twoFactorMutation.isPending}
                        onClick={() => void handleTwoFactor()}>
                        <Trans id="settings.users.actions.two_factor_action">Turn off 2FA</Trans>
                    </Button>
                )}
                {user.canDelete && (
                    <Button
                        density="compact"
                        size="sm"
                        variant="danger"
                        onClick={() => {
                            setConfirmation('');
                            setIsDeleteOpen(true);
                        }}>
                        <Trash2 aria-hidden="true" className="h-4 w-4" />
                        <Trans id="settings.users.actions.delete">Delete account</Trans>
                    </Button>
                )}
            </div>

            <Modal
                isOpen={isDeleteOpen}
                onClose={() => setIsDeleteOpen(false)}
                ariaTitle={t({
                    id: 'settings.users.actions.delete_title',
                    message: 'Delete account'
                })}
                maxWidth="md"
                showCloseButton={false}>
                <Modal.Body>
                    <h3 className="mb-2 text-lg font-semibold text-content">
                        <Trans id="settings.users.actions.delete_title">Delete account</Trans>
                    </h3>
                    <p className="mb-4 text-sm text-content-secondary">
                        {i18n._({
                            id: 'settings.users.actions.delete_message',
                            message: 'This permanently deletes {username} and their {postCount} posts. It cannot be undone. Their comments stay as deleted comments.',
                            values: {
                                username: user.username,
                                postCount: user.postCount
                            }
                        })}
                    </p>
                    <Input
                        density="compact"
                        autoComplete="off"
                        aria-label={t({
                            id: 'settings.users.actions.delete_confirm_label',
                            message: 'Type the username to confirm'
                        })}
                        placeholder={user.username}
                        value={confirmation}
                        onChange={(event) => setConfirmation(event.target.value)}
                    />
                    <div className="mt-6 flex justify-end gap-2">
                        <Button density="compact" variant="secondary" onClick={() => setIsDeleteOpen(false)}>
                            <Trans id="common.cancel">Cancel</Trans>
                        </Button>
                        <Button
                            density="compact"
                            variant="danger"
                            disabled={confirmation !== user.username}
                            isLoading={deleteMutation.isPending}
                            onClick={() => deleteMutation.mutate()}>
                            <Trans id="settings.users.actions.delete">Delete account</Trans>
                        </Button>
                    </div>
                </Modal.Body>
            </Modal>

            <Modal
                isOpen={passwordLink !== null}
                onClose={() => setPasswordLink(null)}
                ariaTitle={t({
                    id: 'settings.users.actions.password_ready_title',
                    message: 'Password reset link'
                })}
                maxWidth="md"
                showCloseButton={false}>
                <Modal.Body>
                    <h3 className="mb-2 text-lg font-semibold text-content">
                        <Trans id="settings.users.actions.password_ready_title">Password reset link</Trans>
                    </h3>
                    <p className="mb-4 text-sm text-content-secondary">
                        {passwordLink && i18n._({
                            id: 'settings.users.actions.password_ready_message',
                            message: 'Send this to {username}. It stops working on {expires} or once a new password is saved, and it will not be shown again.',
                            values: {
                                username: user.username,
                                expires: new Intl.DateTimeFormat(normalizeLocale(i18n.locale), {
                                    dateStyle: 'medium',
                                    timeStyle: 'short',
                                    timeZone: getDocumentTimeZone()
                                }).format(new Date(passwordLink.expiresDate))
                            }
                        })}
                    </p>
                    <code className="block break-all rounded-lg bg-surface-subtle px-3 py-2 text-xs text-content">
                        {passwordLink?.url}
                    </code>
                    <div className="mt-6 flex justify-end gap-2">
                        <Button density="compact" variant="secondary" onClick={() => setPasswordLink(null)}>
                            <Trans id="common.close">Close</Trans>
                        </Button>
                        <Button density="compact" variant="primary" onClick={() => void handleCopyLink()}>
                            <Copy aria-hidden="true" className="h-4 w-4" />
                            <Trans id="settings.users.actions.password_copy">Copy link</Trans>
                        </Button>
                    </div>
                </Modal.Body>
            </Modal>
        </div>
    );
};
