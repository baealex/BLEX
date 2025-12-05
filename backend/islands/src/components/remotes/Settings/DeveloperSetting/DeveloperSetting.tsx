import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '~/utils/toast';
import { Button } from '~/components/shared';
import { useConfirm } from '~/contexts/ConfirmContext';
import {
    getWebhooks,
    getWebhookEvents,
    createWebhook,
    updateWebhook,
    deleteWebhook,
    testWebhook
} from '~/lib/api/developer';

interface Webhook {
    id: number;
    name: string;
    url: string;
    provider: string;
    events: string[];
    isActive: boolean;
    createdDate: string;
    updatedDate: string;
}

interface WebhookEvent {
    value: string;
    description: string;
}

interface WebhookProvider {
    value: string;
    description: string;
}

const DeveloperSetting = () => {
    const [isCreating, setIsCreating] = useState(false);
    const [editingWebhook, setEditingWebhook] = useState<Webhook | null>(null);
    const { confirm } = useConfirm();
    const queryClient = useQueryClient();

    const { data: webhooksData, isLoading: isLoadingWebhooks } = useQuery({
        queryKey: ['webhooks'],
        queryFn: async () => {
            const { data } = await getWebhooks();
            if (data.status === 'DONE') {
                return data.body;
            }
            throw new Error('웹훅 목록을 불러오는데 실패했습니다.');
        }
    });

    const { data: eventsData } = useQuery({
        queryKey: ['webhook-events'],
        queryFn: async () => {
            const { data } = await getWebhookEvents();
            if (data.status === 'DONE') {
                return data.body;
            }
            throw new Error('웹훅 이벤트 정보를 불러오는데 실패했습니다.');
        }
    });

    const deleteMutation = useMutation({
        mutationFn: deleteWebhook,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['webhooks'] });
            toast.success('웹훅이 삭제되었습니다.');
        },
        onError: () => {
            toast.error('웹훅 삭제에 실패했습니다.');
        }
    });

    const testMutation = useMutation({
        mutationFn: testWebhook,
        onSuccess: () => {
            toast.success('테스트 웹훅이 전송되었습니다.');
        },
        onError: () => {
            toast.error('웹훅 전송에 실패했습니다.');
        }
    });

    const handleDelete = async (webhook: Webhook) => {
        const confirmed = await confirm({
            title: '웹훅 삭제',
            message: `"${webhook.name}" 웹훅을 삭제할까요?`,
            confirmText: '삭제',
            variant: 'danger'
        });

        if (confirmed) {
            deleteMutation.mutate(webhook.id);
        }
    };

    const handleTest = (webhook: Webhook) => {
        testMutation.mutate(webhook.id);
    };

    const webhooks = webhooksData?.webhooks || [];
    const events = eventsData?.events || [];
    const providers = eventsData?.providers || [];

    return (
        <div className="space-y-6">
            {/* 헤더 */}
            <div className="bg-white rounded-3xl border border-gray-200 p-8">
                <h1 className="text-2xl font-bold text-gray-900 mb-2">개발자 설정</h1>
                <p className="text-gray-600">웹훅을 등록하고 BLEX의 이벤트를 실시간으로 받아보세요.</p>
            </div>

            {/* 웹훅 목록 */}
            <div className="bg-white rounded-3xl border border-gray-200 p-8">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold text-gray-900">웹훅</h2>
                    <Button
                        onClick={() => setIsCreating(true)}
                        className="px-4 py-2 bg-black text-white rounded-xl hover:bg-gray-800"
                    >
                        <i className="fas fa-plus mr-2"></i>
                        웹훅 추가
                    </Button>
                </div>

                {isLoadingWebhooks ? (
                    <div className="text-center py-12">
                        <i className="fas fa-spinner fa-spin text-3xl text-gray-400"></i>
                        <p className="text-gray-500 mt-4">로딩 중...</p>
                    </div>
                ) : webhooks.length === 0 ? (
                    <div className="text-center py-12 bg-gray-50 rounded-2xl">
                        <i className="fas fa-webhook text-5xl text-gray-300 mb-4"></i>
                        <p className="text-gray-500">등록된 웹훅이 없습니다.</p>
                        <p className="text-gray-400 text-sm mt-2">웹훅을 추가하여 이벤트를 실시간으로 받아보세요.</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {webhooks.map((webhook: Webhook) => (
                            <div
                                key={webhook.id}
                                className="border border-gray-200 rounded-2xl p-6 hover:border-gray-300 transition-colors"
                            >
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <h3 className="text-lg font-semibold text-gray-900">{webhook.name}</h3>
                                            <span
                                                className={`px-3 py-1 rounded-full text-xs font-medium ${
                                                    webhook.isActive
                                                        ? 'bg-green-100 text-green-700'
                                                        : 'bg-gray-100 text-gray-600'
                                                }`}
                                            >
                                                {webhook.isActive ? '활성화' : '비활성화'}
                                            </span>
                                            <span className="px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                                                {providers.find((p: WebhookProvider) => p.value === webhook.provider)?.description || webhook.provider}
                                            </span>
                                        </div>
                                        <p className="text-sm text-gray-600 font-mono mb-3">{webhook.url}</p>
                                        <div className="flex flex-wrap gap-2">
                                            {webhook.events.map((event) => (
                                                <span
                                                    key={event}
                                                    className="px-2 py-1 bg-gray-100 text-gray-700 rounded-lg text-xs"
                                                >
                                                    {events.find((e: WebhookEvent) => e.value === event)?.description || event}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 ml-4">
                                        <button
                                            onClick={() => handleTest(webhook)}
                                            disabled={testMutation.isPending}
                                            className="px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-xl transition-colors"
                                        >
                                            <i className="fas fa-paper-plane mr-1"></i>
                                            테스트
                                        </button>
                                        <button
                                            onClick={() => setEditingWebhook(webhook)}
                                            className="px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-xl transition-colors"
                                        >
                                            <i className="fas fa-edit mr-1"></i>
                                            수정
                                        </button>
                                        <button
                                            onClick={() => handleDelete(webhook)}
                                            disabled={deleteMutation.isPending}
                                            className="px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                                        >
                                            <i className="fas fa-trash mr-1"></i>
                                            삭제
                                        </button>
                                    </div>
                                </div>
                                <div className="text-xs text-gray-400">
                                    등록일: {new Date(webhook.createdDate).toLocaleString('ko-KR')}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* 웹훅 생성/수정 모달 */}
            {(isCreating || editingWebhook) && (
                <WebhookModal
                    webhook={editingWebhook}
                    events={events}
                    providers={providers}
                    onClose={() => {
                        setIsCreating(false);
                        setEditingWebhook(null);
                    }}
                    onSuccess={() => {
                        queryClient.invalidateQueries({ queryKey: ['webhooks'] });
                        setIsCreating(false);
                        setEditingWebhook(null);
                    }}
                />
            )}
        </div>
    );
};

interface WebhookModalProps {
    webhook: Webhook | null;
    events: WebhookEvent[];
    providers: WebhookProvider[];
    onClose: () => void;
    onSuccess: () => void;
}

const WebhookModal = ({ webhook, events, providers, onClose, onSuccess }: WebhookModalProps) => {
    const [name, setName] = useState(webhook?.name || '');
    const [url, setUrl] = useState(webhook?.url || '');
    const [provider, setProvider] = useState(webhook?.provider || 'generic');
    const [selectedEvents, setSelectedEvents] = useState<string[]>(webhook?.events || []);
    const [isActive, setIsActive] = useState(webhook?.isActive ?? true);
    const [secret, setSecret] = useState('');

    const saveMutation = useMutation({
        mutationFn: async (data: any) => {
            if (webhook) {
                return updateWebhook(webhook.id, data);
            } else {
                return createWebhook(data);
            }
        },
        onSuccess: () => {
            toast.success(webhook ? '웹훅이 수정되었습니다.' : '웹훅이 생성되었습니다.');
            onSuccess();
        },
        onError: (error: any) => {
            toast.error(error.response?.data?.errorMessage || '웹훅 저장에 실패했습니다.');
        }
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (!name.trim()) {
            toast.error('웹훅 이름을 입력해주세요.');
            return;
        }
        if (!url.trim()) {
            toast.error('웹훅 URL을 입력해주세요.');
            return;
        }
        if (selectedEvents.length === 0) {
            toast.error('최소 하나의 이벤트를 선택해주세요.');
            return;
        }

        saveMutation.mutate({
            name,
            url,
            provider,
            events: selectedEvents,
            isActive,
            secret
        });
    };

    const toggleEvent = (eventValue: string) => {
        setSelectedEvents((prev) =>
            prev.includes(eventValue)
                ? prev.filter((e) => e !== eventValue)
                : [...prev, eventValue]
        );
    };

    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <div className="sticky top-0 bg-white border-b border-gray-200 px-8 py-6 rounded-t-3xl">
                    <div className="flex items-center justify-between">
                        <h2 className="text-2xl font-bold text-gray-900">
                            {webhook ? '웹훅 수정' : '웹훅 추가'}
                        </h2>
                        <button
                            onClick={onClose}
                            className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-colors"
                        >
                            <i className="fas fa-times text-xl text-gray-500"></i>
                        </button>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="p-8 space-y-6">
                    {/* 웹훅 이름 */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            웹훅 이름
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-black focus:border-transparent"
                            placeholder="예: 내 Discord 서버"
                        />
                    </div>

                    {/* 웹훅 URL */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            웹훅 URL
                        </label>
                        <input
                            type="url"
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-black focus:border-transparent font-mono text-sm"
                            placeholder="https://discord.com/api/webhooks/..."
                        />
                    </div>

                    {/* 제공자 */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            제공자
                        </label>
                        <select
                            value={provider}
                            onChange={(e) => setProvider(e.target.value)}
                            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-black focus:border-transparent"
                        >
                            {providers.map((p: WebhookProvider) => (
                                <option key={p.value} value={p.value}>
                                    {p.description}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* 이벤트 선택 */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-3">
                            구독할 이벤트
                        </label>
                        <div className="space-y-2">
                            {events.map((event: WebhookEvent) => (
                                <label
                                    key={event.value}
                                    className="flex items-center p-4 border border-gray-200 rounded-xl hover:bg-gray-50 cursor-pointer transition-colors"
                                >
                                    <input
                                        type="checkbox"
                                        checked={selectedEvents.includes(event.value)}
                                        onChange={() => toggleEvent(event.value)}
                                        className="w-5 h-5 text-black border-gray-300 rounded focus:ring-black"
                                    />
                                    <span className="ml-3 text-sm text-gray-900">{event.description}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* 시크릿 (선택사항) */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            시크릿 (선택사항)
                        </label>
                        <input
                            type="text"
                            value={secret}
                            onChange={(e) => setSecret(e.target.value)}
                            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-black focus:border-transparent font-mono text-sm"
                            placeholder="웹훅 검증용 시크릿 키"
                        />
                        <p className="mt-2 text-xs text-gray-500">
                            웹훅 요청 시 X-Webhook-Secret 헤더에 포함됩니다.
                        </p>
                    </div>

                    {/* 활성화 */}
                    <div className="flex items-center">
                        <input
                            type="checkbox"
                            id="isActive"
                            checked={isActive}
                            onChange={(e) => setIsActive(e.target.checked)}
                            className="w-5 h-5 text-black border-gray-300 rounded focus:ring-black"
                        />
                        <label htmlFor="isActive" className="ml-3 text-sm text-gray-900">
                            웹훅 활성화
                        </label>
                    </div>

                    {/* 버튼 */}
                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 font-medium transition-colors"
                        >
                            취소
                        </button>
                        <button
                            type="submit"
                            disabled={saveMutation.isPending}
                            className="flex-1 px-6 py-3 bg-black text-white rounded-xl hover:bg-gray-800 font-medium transition-colors disabled:opacity-50"
                        >
                            {saveMutation.isPending ? (
                                <>
                                    <i className="fas fa-spinner fa-spin mr-2"></i>
                                    저장 중...
                                </>
                            ) : (
                                webhook ? '수정' : '생성'
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default DeveloperSetting;
