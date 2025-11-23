import { useEffect } from 'react';
import { toast } from '~/utils/toast';
import { Modal } from '~/components/shared';
import { updateNotifyConfig } from '~/lib/api/settings';

// Notify config labels
const NOTIFY_CONFIG_LABEL = {
    'NOTIFY_POSTS_LIKE': '다른 사용자가 내 글 추천',
    'NOTIFY_POSTS_COMMENT': '다른 사용자가 내 글에 댓글 작성',
    'NOTIFY_COMMENT_LIKE': '다른 사용자가 내 댓글 추천',
    'NOTIFY_MENTION': '다른 사용자가 댓글에서 나를 언급'
} as const;

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
    useEffect(() => {
        if (isError) {
            toast.error('알림 설정을 불러오는데 실패했습니다.');
        }
    }, [isError]);

    const handleToggleConfig = async (name: keyof typeof NOTIFY_CONFIG_LABEL) => {
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
                toast.success('알림 설정이 업데이트 되었습니다.');
                refetch();
            } else {
                toast.error('알림 설정 업데이트에 실패했습니다.');
            }
        } catch {
            toast.error('알림 설정 업데이트에 실패했습니다.');
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="알림 설정"
            maxWidth="md">
            <div className="p-6 space-y-4">
                {isLoading ? null : (
                    notifyConfig?.map((item) => (
                        <div key={item.name} className="flex items-center justify-between py-3 px-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                            <span className="text-sm font-medium text-gray-900">
                                {NOTIFY_CONFIG_LABEL[item.name as keyof typeof NOTIFY_CONFIG_LABEL]}
                            </span>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="sr-only peer"
                                    checked={item.value}
                                    onChange={() => handleToggleConfig(item.name as keyof typeof NOTIFY_CONFIG_LABEL)}
                                />
                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-gray-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-black" />
                            </label>
                        </div>
                    ))
                )}
            </div>
        </Modal>
    );
};

export default NotifyConfigModal;
