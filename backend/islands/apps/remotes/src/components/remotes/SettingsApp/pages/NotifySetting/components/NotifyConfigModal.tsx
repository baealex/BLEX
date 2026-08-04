import { useEffect } from 'react';
import { useLingui } from '@lingui/react/macro';
import { toast } from '~/utils/toast';
import { Modal } from '~/components/shared';
import { updateNotifyConfig } from '~/lib/api/settings';

interface NotifyConfigModalProps {
    isOpen: boolean;
    onClose: () => void;
    notifyConfig?: { name: string; value: boolean }[];
    isLoading: boolean;
    isError: boolean;
    refetch: () => void;
}

const NotifyConfigModal = ({
    isOpen,
    onClose,
    notifyConfig,
    isLoading,
    isError,
    refetch
}: NotifyConfigModalProps) => {
    const { t } = useLingui();
    const getNotifyLabel = (name: string) => {
        switch (name) {
            case 'NOTIFY_POSTS_LIKE':
                return t({
                    id: 'settings.notifications.config.post_likes',
                    message: 'Someone likes one of my posts'
                });
            case 'NOTIFY_POSTS_COMMENT':
                return t({
                    id: 'settings.notifications.config.post_comments',
                    message: 'Someone comments on one of my posts'
                });
            case 'NOTIFY_COMMENT_LIKE':
                return t({
                    id: 'settings.notifications.config.comment_likes',
                    message: 'Someone likes one of my comments'
                });
            case 'NOTIFY_MENTION':
                return t({
                    id: 'settings.notifications.config.mentions',
                    message: 'Someone mentions me in a comment'
                });
            default:
                return name;
        }
    };

    useEffect(() => {
        if (isError) {
            toast.error(t({
                id: 'settings.notifications.config.load_failed',
                message: 'Could not load notification settings.'
            }));
        }
    }, [isError, t]);

    const handleToggleConfig = async (name: string) => {
        if (!notifyConfig) return;

        const nextState = notifyConfig.map((item) => {
            if (item.name === name) {
                return {
                    ...item,
                    value: !item.value
                };
            }
            return item;
        });

        try {
            // Convert array to NotifyConfig object
            const config: Record<string, boolean> = {};
            nextState.forEach(item => {
                config[item.name] = item.value;
            });

            const { data } = await updateNotifyConfig(config);

            if (data.status === 'DONE') {
                toast.success(t({
                    id: 'settings.notifications.config.update_success',
                    message: 'Notification settings updated.'
                }));
                refetch();
            } else {
                toast.error(data.errorMessage || t({
                    id: 'settings.notifications.config.update_failed',
                    message: 'Could not update notification settings.'
                }));
            }
        } catch {
            toast.error(t({
                id: 'settings.notifications.config.update_failed',
                message: 'Could not update notification settings.'
            }));
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={t({
                id: 'settings.notifications.config.title',
                message: 'Notification settings'
            })}
            maxWidth="md">
            <div className="p-6 space-y-2">
                {isLoading ? null : (
                    notifyConfig?.map((item) => (
                        <div key={item.name} className="flex items-center justify-between py-4 px-2 hover:bg-surface-subtle rounded-xl transition-colors group">
                            <span className="text-sm font-semibold text-content group-hover:text-content transition-colors">
                                {getNotifyLabel(item.name)}
                            </span>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    aria-label={getNotifyLabel(item.name)}
                                    className="sr-only peer"
                                    checked={item.value}
                                    onChange={() => handleToggleConfig(item.name)}
                                />
                                <div className="w-11 h-6 bg-line peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-line-light after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-surface after:border-line after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-action shadow-inner transition-colors duration-200" />
                            </label>
                        </div>
                    ))
                )}
            </div>
        </Modal>
    );
};

export default NotifyConfigModal;
