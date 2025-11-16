import { http } from '~/modules/http.module';
import { notification } from '@baejino/ui';
import { useFetch } from '~/hooks/use-fetch';
import type { Response } from '~/modules/http.module';
import { Button, LoadingState } from '~/components/shared';

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
        return <LoadingState type="list" rows={2} />;
    }

    const invitationList = Array.isArray(invitations?.invitations) ? invitations.invitations : [];

    return (
        <div className="p-6 bg-white shadow-sm rounded-2xl border border-gray-200">
            {/* Header Section */}
            <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">에디터 초대 요청</h2>
                <p className="text-gray-600 mb-6">다른 에디터로부터 받은 초대 요청을 확인하고 응답하세요.</p>

                <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5 space-y-3">
                    <div className="flex items-center text-sm text-gray-700">
                        <div className="w-6 h-6 bg-black rounded-full flex items-center justify-center mr-3 flex-shrink-0">
                            <i className="fas fa-check text-white text-xs" />
                        </div>
                        초대를 승낙하면 해당 블로그의 에디터가 됩니다
                    </div>
                    <div className="flex items-center text-sm text-gray-700">
                        <div className="w-6 h-6 bg-black rounded-full flex items-center justify-center mr-3 flex-shrink-0">
                            <i className="fas fa-check text-white text-xs" />
                        </div>
                        에디터는 포스트 작성 및 관리 권한을 가집니다
                    </div>
                </div>
            </div>

            {/* Invitation List */}
            {invitationList.length === 0 ? (
                <div className="text-center py-16">
                    <div className="w-20 h-20 mx-auto bg-gray-100 rounded-2xl flex items-center justify-center mb-6">
                        <i className="fas fa-inbox text-gray-400 text-3xl" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">초대 요청이 없습니다</h3>
                    <p className="text-gray-500">현재 받은 에디터 초대 요청이 없습니다.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {invitationList.map((invitation) => (
                        <div key={invitation.id} className="bg-gray-50 rounded-2xl border border-gray-200 p-6">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                                <div className="flex items-center space-x-4">
                                    {invitation.senderImage ? (
                                        <img
                                            src={invitation.senderImage}
                                            alt="Profile"
                                            className="w-16 h-16 rounded-full object-cover border-4 border-white shadow-lg flex-shrink-0"
                                        />
                                    ) : (
                                        <div className="w-16 h-16 rounded-full flex-shrink-0 bg-gray-200 flex items-center justify-center border-4 border-white shadow-lg">
                                            <i className="fas fa-user text-gray-600 text-xl" />
                                        </div>
                                    )}
                                    <div className="min-w-0 flex-1">
                                        <h3 className="text-lg font-bold text-gray-900 truncate">{invitation.sender}</h3>
                                        <p className="text-sm text-gray-500">{invitation.createdDate}</p>
                                    </div>
                                </div>
                                <div className="flex space-x-2 sm:flex-shrink-0">
                                    <Button
                                        variant="secondary"
                                        size="md"
                                        onClick={() => respondToInvitation(invitation.id, 'reject')}
                                        className="flex-1 sm:flex-none">
                                        거절
                                    </Button>
                                    <Button
                                        variant="primary"
                                        size="md"
                                        onClick={() => respondToInvitation(invitation.id, 'accept')}
                                        className="flex-1 sm:flex-none">
                                        승낙
                                    </Button>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">초대 메시지</label>
                                <textarea
                                    className="w-full px-4 py-3 text-sm text-gray-700 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-gray-500 resize-none shadow-sm"
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
