import { useState } from 'react';
import { http } from '~/modules/http.module';
import { notification } from '@baejino/ui';
import { useFetch } from '~/hooks/use-fetch';
import type { Response } from '~/modules/http.module';

interface InvitationOwner {
    user: string;
    userImage: string;
    userDescription: string;
}

const InvitationRequest = () => {
    const [selectedOwner, setSelectedOwner] = useState<string>('');
    const [content, setContent] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const { data: owners, isLoading } = useFetch({
        queryKey: ['invitation-owners'],
        queryFn: async () => {
            const { data } = await http.get<Response<InvitationOwner[]>>('/v1/invitation/owners');
            if (data.status === 'DONE') {
                return { owners: data.body || [] };
            }
            return { owners: [] };
        }
    });

    const submitRequest = async () => {
        if (!selectedOwner) {
            notification('초대받을 에디터를 선택해주세요.', { type: 'error' });
            return;
        }

        if (!content.trim()) {
            notification('초대 요청 내용을 입력해주세요.', { type: 'error' });
            return;
        }

        setIsSubmitting(true);
        try {
            const { data } = await http.post('/v1/invitation/requests', {
                receiver: selectedOwner,
                content: content.trim()
            });

            if (data.status === 'DONE') {
                notification('초대 요청을 전송했습니다.', { type: 'success' });
                setContent('');
                setSelectedOwner('');
            } else {
                notification(data.errorMessage || '초대 요청 전송에 실패했습니다.', { type: 'error' });
            }
        } catch {
            notification('초대 요청 전송 중 오류가 발생했습니다.', { type: 'error' });
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isLoading) {
        return (
            <div className="p-4 sm:p-6 bg-white shadow-md rounded-lg">
                <div className="animate-pulse">
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4 sm:p-6 mb-4 sm:mb-6">
                        <div className="h-6 bg-gray-200 rounded w-64 mb-2" />
                        <div className="h-4 bg-gray-200 rounded w-full mb-2" />
                        <div className="h-4 bg-gray-200 rounded w-3/4" />
                    </div>
                    <div className="space-y-4">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                                <div className="h-16 bg-gray-200 rounded" />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    const ownersList = owners?.owners || [];

    return (
        <div className="p-4 sm:p-6 bg-white shadow-md rounded-lg">
            {/* Header Section */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4 sm:p-6 mb-4 sm:mb-6">
                <h2 className="text-lg sm:text-xl font-bold text-blue-900 mb-2">에디터 초대 요청</h2>
                <p className="text-blue-700 mb-4">포스트를 작성하려면 기존 에디터로부터 초대를 받아야 합니다.</p>

                <div className="space-y-2">
                    <div className="flex items-center text-sm text-blue-700">
                        <i className="fas fa-check-circle mr-2 text-blue-600" />
                        에디터에게 초대를 요청하여 블로그 작성 권한을 받으세요
                    </div>
                    <div className="flex items-center text-sm text-blue-700">
                        <i className="fas fa-check-circle mr-2 text-blue-600" />
                        자세한 자기소개와 함께 요청하면 승낙 확률이 높아집니다
                    </div>
                </div>
            </div>

            {/* Guide Section */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
                <h3 className="font-semibold text-amber-800 mb-2">
                    <i className="fas fa-lightbulb mr-2" />
                    초대 요청 작성 가이드
                </h3>
                <ul className="text-sm text-amber-700 space-y-1">
                    <li>• 자신의 배경과 전문 분야를 간략하게 소개해주세요</li>
                    <li>• 어떤 주제로 포스트를 작성하고 싶은지 설명해주세요</li>
                    <li>• 기존 작품이나 프로젝트가 있다면 링크를 포함해주세요</li>
                    <li>• 정중하고 성의 있는 문구로 작성하시기 바랍니다</li>
                </ul>
            </div>

            {/* Owner Selection */}
            {ownersList.length === 0 ? (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 sm:p-6">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center justify-center w-12 h-12 bg-gray-100 rounded-full flex-shrink-0">
                            <i className="fas fa-users text-gray-600 text-xl" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-gray-900">현재 초대 가능한 에디터가 없습니다</h3>
                            <p className="text-sm text-gray-700 mt-1">나중에 다시 확인해 보세요.</p>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="space-y-6">
                    {/* Editor List */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-3">
                            초대받을 에디터를 선택하세요
                        </label>
                        <div className="grid gap-3">
                            {ownersList.map((owner) => (
                                <label key={owner.user} className="cursor-pointer">
                                    <input
                                        type="radio"
                                        name="owner"
                                        value={owner.user}
                                        checked={selectedOwner === owner.user}
                                        onChange={(e) => setSelectedOwner(e.target.value)}
                                        className="sr-only"
                                    />
                                    <div
                                        className={`p-4 rounded-lg border-2 transition-colors ${selectedOwner === owner.user
                                            ? 'border-blue-500 bg-blue-50'
                                            : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                                            }`}>
                                        <div className="flex items-center space-x-4">
                                            <img
                                                src={owner.userImage}
                                                alt={owner.user}
                                                className="w-12 h-12 rounded-full object-cover flex-shrink-0"
                                            />
                                            <div className="flex-1 min-w-0">
                                                <h3 className="text-lg font-semibold text-gray-900">{owner.user}</h3>
                                                <p className="text-sm text-gray-600 mt-1">{owner.userDescription}</p>
                                            </div>
                                            {selectedOwner === owner.user && (
                                                <div className="text-blue-600">
                                                    <i className="fas fa-check-circle text-xl" />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Content Input */}
                    <div>
                        <label htmlFor="content" className="block text-sm font-medium text-gray-700 mb-2">
                            초대 요청 메시지
                        </label>
                        <textarea
                            id="content"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                            rows={6}
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            placeholder="안녕하세요, 저는... (자기소개와 함께 정중하게 작성해주세요)"
                        />
                        <div className="mt-1 text-sm text-gray-500">
                            {content.length}/500자
                        </div>
                    </div>

                    {/* Submit Button */}
                    <button
                        type="button"
                        onClick={submitRequest}
                        disabled={isSubmitting || !selectedOwner || !content.trim()}
                        className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                        {isSubmitting ? (
                            <>
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                                전송 중...
                            </>
                        ) : (
                            <>
                                <i className="fas fa-paper-plane mr-2" />
                                초대 요청 보내기
                            </>
                        )}
                    </button>
                </div>
            )}
        </div>
    );
};

export default InvitationRequest;
