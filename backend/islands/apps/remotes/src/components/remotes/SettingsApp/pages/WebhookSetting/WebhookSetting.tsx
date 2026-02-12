import { useState } from 'react';
import { toast } from '~/utils/toast';
import { useSuspenseQuery } from '@tanstack/react-query';
import { SettingsHeader, SettingsListItem } from '../../components';
import { Button, Dropdown, Input } from '~/components/shared';
import {
    getIconClass,
    TITLE,
    SUBTITLE
} from '~/components/shared';
import { useConfirm } from '~/hooks/useConfirm';
import {
    getWebhookChannels,
    addWebhookChannel,
    deleteWebhookChannel,
    testWebhook
} from '~/lib/api/settings';

const WebhookSetting = () => {
    const { confirm } = useConfirm();
    const [isAdding, setIsAdding] = useState(false);
    const [isTesting, setIsTesting] = useState(false);
    const [newWebhookUrl, setNewWebhookUrl] = useState('');
    const [newWebhookName, setNewWebhookName] = useState('');
    const [showAddForm, setShowAddForm] = useState(false);

    const { data: channels, refetch } = useSuspenseQuery({
        queryKey: ['webhook-channels'],
        queryFn: async () => {
            const { data } = await getWebhookChannels();
            if (data.status === 'DONE') {
                return data.body.channels;
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
            const { data } = await testWebhook(newWebhookUrl);
            if (data.status === 'DONE' && data.body.success) {
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
            const { data } = await addWebhookChannel({
                webhook_url: newWebhookUrl,
                name: newWebhookName || undefined
            });

            if (data.status === 'DONE') {
                toast.success('웹훅 채널이 추가되었습니다.');
                setNewWebhookUrl('');
                setNewWebhookName('');
                setShowAddForm(false);
                refetch();
            } else {
                toast.error(data.errorMessage || '웹훅 채널 추가에 실패했습니다.');
            }
        } catch {
            toast.error('웹훅 채널 추가 중 오류가 발생했습니다.');
        } finally {
            setIsAdding(false);
        }
    };

    const handleDelete = async (channelId: number) => {
        const confirmed = await confirm({
            title: '웹훅 채널 삭제',
            message: '정말 이 웹훅 채널을 삭제할까요?',
            confirmText: '삭제',
            variant: 'danger'
        });

        if (!confirmed) return;

        try {
            const { data } = await deleteWebhookChannel(channelId);

            if (data.status === 'DONE') {
                toast.success('웹훅 채널이 삭제되었습니다.');
                refetch();
            } else {
                throw new Error('Failed to delete webhook channel');
            }
        } catch {
            toast.error('웹훅 채널 삭제에 실패했습니다.');
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
                title="웹훅 채널"
                description="새 글이 발행되면 등록된 채널로 자동 알림을 보냅니다."
                action={
                    <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5 space-y-3">
                        <div className="flex items-center text-sm text-gray-700">
                            <div className="w-6 h-6 bg-black rounded-full flex items-center justify-center mr-3 flex-shrink-0">
                                <i className="fas fa-check text-white text-xs" />
                            </div>
                            Discord, Slack 등 웹훅을 지원하는 서비스와 연동됩니다
                        </div>
                        <div className="flex items-center text-sm text-gray-700">
                            <div className="w-6 h-6 bg-black rounded-full flex items-center justify-center mr-3 flex-shrink-0">
                                <i className="fas fa-check text-white text-xs" />
                            </div>
                            3회 연속 실패시 자동으로 비활성화됩니다
                        </div>
                    </div>
                }
            />

            {/* Add Channel Button or Form */}
            {!showAddForm && channels && channels.length > 0 && (
                <div className="mb-6">
                    <Button
                        variant="primary"
                        size="md"
                        leftIcon={<i className="fas fa-plus" />}
                        onClick={() => setShowAddForm(true)}>
                        채널 추가
                    </Button>
                </div>
            )}
            {showAddForm && (
                <div className="mb-6 bg-gray-50 border border-gray-200 rounded-2xl p-6">
                    <h3 className="text-base font-semibold text-gray-900 mb-4">새 웹훅 채널 추가</h3>
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
                                placeholder="예: 내 디스코드 서버"
                                value={newWebhookName}
                                onChange={(e) => setNewWebhookName(e.target.value)}
                            />
                        </div>
                        <div className="flex flex-wrap gap-3">
                            <Button
                                variant="secondary"
                                size="md"
                                isLoading={isTesting}
                                leftIcon={!isTesting ? <i className="fas fa-paper-plane" /> : undefined}
                                onClick={handleTest}>
                                {isTesting ? '전송 중...' : '테스트'}
                            </Button>
                            <Button
                                variant="primary"
                                size="md"
                                isLoading={isAdding}
                                leftIcon={!isAdding ? <i className="fas fa-plus" /> : undefined}
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

            {/* Channel List */}
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
                <div className="py-16 text-center border border-dashed border-gray-200 rounded-2xl">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gray-50 mb-4">
                        <i className="fas fa-bolt text-2xl text-gray-300" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">등록된 웹훅 채널이 없습니다</h3>
                    <p className="text-gray-500 text-sm mb-6">새 채널을 추가해서 글 발행 알림을 받아보세요.</p>
                    <Button variant="secondary" size="md" onClick={() => setShowAddForm(true)}>
                        채널 추가하기
                    </Button>
                </div>
            )}
        </div>
    );
};

export default WebhookSetting;
