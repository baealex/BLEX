import { http } from '~/modules/http.module';
import { notification } from '@baejino/ui';
import { useFetch } from '~/hooks/use-fetch';
import type { Response } from '~/modules/http.module';

interface InvitationItem {
    id: number;
    sender: string;
    senderImage: string;
    content: string;
    createdDate: string;
}

const InvitationManagement = () => {
    const { data: invitations, isLoading, refetch } = useFetch({
        queryKey: ['invitations'],
        queryFn: async () => {
            const { data } = await http.get<Response<InvitationItem[]>>('/v1/invitation/requests');
            if (data.status === 'DONE') {
                return { invitations: data.body || [] };
            }
            return { invitations: [] };
        }
    });

    const respondToInvitation = async (invitationId: number, action: 'accept' | 'reject') => {
        const actionText = action === 'accept' ? '승낙' : '거절';

        if (!confirm(`정말 이 초대를 ${actionText}하시겠습니까?`)) {
            return;
        }

        try {
            const { data } = await http.put(`/v1/invitation/${invitationId}`, { action });

            if (data.status === 'DONE') {
                notification(`초대를 ${actionText}했습니다.`, { type: 'success' });
                refetch();
            } else {
                notification(data.errorMessage || `초대 ${actionText}에 실패했습니다.`, { type: 'error' });
            }
        } catch {
            notification(`초대 ${actionText}에 실패했습니다.`, { type: 'error' });
        }
    };

    if (isLoading) {
        return (
            <div className="p-4 sm:p-6 bg-white shadow-sm rounded-lg">
                <div className="animate-pulse">
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 sm:p-6 mb-4 sm:mb-6">
                        <div className="h-6 bg-gray-200 rounded w-64 mb-2" />
                        <div className="h-4 bg-gray-200 rounded w-full mb-2" />
                        <div className="h-4 bg-gray-200 rounded w-3/4" />
                    </div>
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 sm:p-6">
                        <div className="h-20 bg-gray-200 rounded" />
                    </div>
                </div>
            </div>
        );
    }

    const invitationList = Array.isArray(invitations?.invitations) ? invitations.invitations : [];

    return (
        <div className="p-4 sm:p-6 bg-white shadow-sm rounded-lg">
            {/* Header Section */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 sm:p-6 mb-4 sm:mb-6">
                <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-2">에디터 초대 요청</h2>
                <p className="text-gray-700 mb-4">다른 에디터로부터 받은 초대 요청을 확인하고 응답하세요.</p>

                <div className="space-y-2">
                    <div className="flex items-center text-sm text-gray-700">
                        <i className="fas fa-check-circle mr-2 text-gray-600" />
                        초대를 승낙하면 해당 블로그의 에디터가 됩니다
                    </div>
                    <div className="flex items-center text-sm text-gray-700">
                        <i className="fas fa-check-circle mr-2 text-gray-600" />
                        에디터는 포스트 작성 및 관리 권한을 가집니다
                    </div>
                </div>
            </div>

            {/* Invitation List */}
            {invitationList.length === 0 ? (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 sm:p-6">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center justify-center w-12 h-12 bg-gray-100 rounded-full flex-shrink-0">
                            <i className="fas fa-inbox text-gray-600 text-xl" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-gray-900">초대 요청이 없습니다</h3>
                            <p className="text-sm text-gray-700 mt-1">현재 받은 에디터 초대 요청이 없습니다.</p>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="space-y-4">
                    {invitationList.map((invitation) => (
                        <div key={invitation.id} className="bg-gray-50 rounded-lg border border-gray-200 p-4 sm:p-6">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
                                <div className="flex items-center space-x-4">
                                    {invitation.senderImage ? (
                                        <img
                                            src={invitation.senderImage}
                                            alt="Profile"
                                            className="w-12 h-12 sm:w-16 sm:h-16 rounded-full object-cover flex-shrink-0"
                                        />
                                    ) : (
                                        <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full flex-shrink-0 bg-gray-200 flex items-center justify-center">
                                            <i className="fas fa-user text-gray-600 text-xl" />
                                        </div>
                                    )}
                                    <div className="min-w-0 flex-1">
                                        <h3 className="text-lg font-semibold text-gray-900 truncate">{invitation.sender}</h3>
                                        <p className="text-sm text-gray-600">{invitation.createdDate}</p>
                                    </div>
                                </div>
                                <div className="flex space-x-3 sm:flex-shrink-0">
                                    <button
                                        type="button"
                                        className="flex-1 sm:flex-none inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors"
                                        onClick={() => respondToInvitation(invitation.id, 'reject')}>
                                        거절
                                    </button>
                                    <button
                                        type="button"
                                        className="flex-1 sm:flex-none inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-black hover:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors"
                                        onClick={() => respondToInvitation(invitation.id, 'accept')}>
                                        승낙
                                    </button>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">초대 메시지</label>
                                <textarea
                                    className="w-full px-3 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500 resize-none"
                                    readOnly
                                    rows={3}
                                    value={invitation.content}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default InvitationManagement;
