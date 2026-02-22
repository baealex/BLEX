import { useState } from 'react';
import type { AxiosResponse } from 'axios';
import { useSuspenseQuery } from '@tanstack/react-query';
import { toast } from '~/utils/toast';
import { useConfirm } from '~/hooks/useConfirm';
import { Button, Dropdown, Input } from '~/components/shared';
import {
    getIconClass,
    TITLE,
    SUBTITLE
} from '~/components/shared';
import { SettingsEmptyState, SettingsHeader, SettingsListItem } from '.';
import type { WebhookChannel } from '~/lib/api/settings';
import type { Response } from '~/lib/http.module';

type ChannelsResponse = Response<{ channels: WebhookChannel[] }>;
type CreateResponse = Response<{ success: boolean; channelId: number }>;
type DeleteResponse = Response<{ success: boolean }>;
type TestResponse = Response<{ success: boolean }>;

interface WebhookChannelManagerProps {
    queryKey: string[];
    title: string;
    description: string;
    formTitle: string;
    emptyTitle: string;
    emptyDescription: string;
    addButtonLabel?: string;
    fetchChannels: () => Promise<AxiosResponse<ChannelsResponse>>;
    createChannel: (data: { webhook_url: string; name?: string }) => Promise<AxiosResponse<CreateResponse>>;
    deleteChannel: (channelId: number) => Promise<AxiosResponse<DeleteResponse>>;
    testChannel: (webhookUrl: string) => Promise<AxiosResponse<TestResponse>>;
    confirmDeleteTitle: string;
    confirmDeleteMessage: string;
    addSuccessMessage: string;
    addFailMessage: string;
    deleteSuccessMessage: string;
    deleteFailMessage: string;
}

const WebhookChannelManager = ({
    queryKey,
    title,
    description,
    formTitle,
    emptyTitle,
    emptyDescription,
    addButtonLabel = '채널 추가',
    fetchChannels,
    createChannel,
    deleteChannel,
    testChannel,
    confirmDeleteTitle,
    confirmDeleteMessage,
    addSuccessMessage,
    addFailMessage,
    deleteSuccessMessage,
    deleteFailMessage
}: WebhookChannelManagerProps) => {
    const { confirm } = useConfirm();
    const [isAdding, setIsAdding] = useState(false);
    const [isTesting, setIsTesting] = useState(false);
    const [newWebhookUrl, setNewWebhookUrl] = useState('');
    const [newWebhookName, setNewWebhookName] = useState('');
    const [showAddForm, setShowAddForm] = useState(false);

    const { data: channels, refetch } = useSuspenseQuery({
        queryKey,
        queryFn: async () => {
            const { data } = await fetchChannels();
            if (data.status === 'DONE') {
                return (data.body.channels ?? []) as WebhookChannel[];
            }
            throw new Error('웹훅 채널 목록을 불러오는데 실패했습니다.');
        }
    });

    const handleTest = async () => {
        if (!newWebhookUrl.trim()) {
            toast.error('웹훅 URL을 입력해주세요.');
            return;
        }

        setIsTesting(true);
        try {
            const { data } = await testChannel(newWebhookUrl);
            if (data.status === 'DONE' && data.body?.success) {
                toast.success('테스트 메시지가 전송되었습니다.');
            } else {
                toast.error('웹훅 테스트에 실패했습니다. URL을 확인해주세요.');
            }
        } catch {
            toast.error('웹훅 테스트 중 오류가 발생했습니다.');
        } finally {
            setIsTesting(false);
        }
    };

    const handleAdd = async () => {
        if (!newWebhookUrl.trim()) {
            toast.error('웹훅 URL을 입력해주세요.');
            return;
        }

        setIsAdding(true);
        try {
            const { data } = await createChannel({
                webhook_url: newWebhookUrl,
                name: newWebhookName || undefined
            });

            if (data.status === 'DONE') {
                toast.success(addSuccessMessage);
                setNewWebhookUrl('');
                setNewWebhookName('');
                setShowAddForm(false);
                refetch();
            } else {
                toast.error(data.errorMessage || addFailMessage);
            }
        } catch {
            toast.error(addFailMessage);
        } finally {
            setIsAdding(false);
        }
    };

    const handleDelete = async (channelId: number) => {
        const confirmed = await confirm({
            title: confirmDeleteTitle,
            message: confirmDeleteMessage,
            confirmText: '삭제',
            variant: 'danger'
        });

        if (!confirmed) return;

        try {
            const { data } = await deleteChannel(channelId);

            if (data.status === 'DONE') {
                toast.success(deleteSuccessMessage);
                refetch();
            } else {
                throw new Error('Failed to delete webhook channel');
            }
        } catch {
            toast.error(deleteFailMessage);
        }
    };

    const getStatusBadge = (channel: { isActive: boolean; failureCount: number }) => {
        if (!channel.isActive) {
            return (
                <span className="bg-gray-900 text-white px-2 py-0.5 rounded-md text-xs font-medium">
                    비활성화
                </span>
            );
        }
        if (channel.failureCount > 0) {
            return (
                <span className="bg-gray-200 text-gray-700 px-2 py-0.5 rounded-md text-xs font-medium">
                    실패 {channel.failureCount}회
                </span>
            );
        }
        return (
            <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-md text-xs font-medium">
                활성
            </span>
        );
    };

    return (
        <div>
            <SettingsHeader
                title={title}
                description={description}
                actionPosition="right"
                action={
                    <Button
                        variant="primary"
                        size="md"
                        className="w-full sm:w-auto"
                        onClick={() => setShowAddForm(true)}>
                        {addButtonLabel}
                    </Button>
                }
            />

            {showAddForm && (
                <div className="mb-6 bg-gray-50 border border-gray-200 rounded-2xl p-6">
                    <h3 className="text-base font-semibold text-gray-900 mb-4">{formTitle}</h3>
                    <div className="space-y-4">
                        <div>
                            <label htmlFor="webhookUrl" className="block text-sm font-medium text-gray-700 mb-1">
                                웹훅 URL <span className="text-red-500">*</span>
                            </label>
                            <Input
                                id="webhookUrl"
                                type="url"
                                placeholder="https://discord.com/api/webhooks/..."
                                value={newWebhookUrl}
                                onChange={(e) => setNewWebhookUrl(e.target.value)}
                            />
                        </div>
                        <div>
                            <label htmlFor="webhookName" className="block text-sm font-medium text-gray-700 mb-1">
                                채널 이름 (선택)
                            </label>
                            <Input
                                id="webhookName"
                                type="text"
                                placeholder="예: 운영 디스코드"
                                value={newWebhookName}
                                onChange={(e) => setNewWebhookName(e.target.value)}
                            />
                        </div>
                        <div className="flex flex-wrap gap-3">
                            <Button
                                variant="secondary"
                                size="md"
                                isLoading={isTesting}
                                onClick={handleTest}>
                                {isTesting ? '전송 중...' : '테스트'}
                            </Button>
                            <Button
                                variant="primary"
                                size="md"
                                isLoading={isAdding}
                                onClick={handleAdd}>
                                {isAdding ? '추가 중...' : '추가'}
                            </Button>
                            <Button
                                variant="ghost"
                                size="md"
                                onClick={() => {
                                    setShowAddForm(false);
                                    setNewWebhookUrl('');
                                    setNewWebhookName('');
                                }}>
                                취소
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {channels && channels.length > 0 ? (
                <div className="space-y-3">
                    {channels.map((channel) => (
                        <SettingsListItem
                            key={channel.id}
                            left={
                                <div className={getIconClass('default')}>
                                    <i className={`fas ${channel.isActive ? 'fa-bolt' : 'fa-exclamation-triangle'} text-sm`} />
                                </div>
                            }
                            actions={
                                <Dropdown
                                    items={[
                                        {
                                            label: '삭제',
                                            icon: 'fas fa-trash',
                                            onClick: () => handleDelete(channel.id),
                                            variant: 'danger'
                                        }
                                    ]}
                                />
                            }>
                            <h3 className={`${TITLE} mb-0.5`}>
                                {channel.name || '이름 없는 채널'}
                            </h3>
                            <div className={`${SUBTITLE} flex flex-wrap items-center gap-3`}>
                                <span className="flex items-center truncate max-w-[200px]" title={channel.webhookUrl}>
                                    <i className="fas fa-link mr-1.5" />
                                    {channel.webhookUrl.replace(/^https?:\/\//, '').slice(0, 30)}...
                                </span>
                                <span className="flex items-center">
                                    <i className="fas fa-clock mr-1.5" />
                                    {channel.createdDate}
                                </span>
                                {getStatusBadge(channel)}
                            </div>
                        </SettingsListItem>
                    ))}
                </div>
            ) : (
                <SettingsEmptyState
                    iconClassName="fas fa-bolt"
                    title={emptyTitle}
                    description={emptyDescription}
                />
            )}
        </div>
    );
};

export default WebhookChannelManager;
