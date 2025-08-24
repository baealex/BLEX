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
        } catch (error) {
            notification(`초대 ${actionText}에 실패했습니다.`, { type: 'error' });
        }
    };

    if (isLoading) {
        return (
            <div className="card setting-card">
                <div className="card-header">
                    <h5 className="card-title mb-0">에디터 초대 요청</h5>
                </div>
                <div className="card-body">
                    <div className="text-center py-3">
                        <div className="spinner-border" role="status">
                            <span className="visually-hidden">로딩중...</span>
                        </div>
                        <div style={{ marginTop: '1rem' }}>데이터를 불러오는 중...</div>
                    </div>
                </div>
            </div>
        );
    }

    const invitationList = invitations?.invitations || [];

    return (
        <div className="card setting-card">
            <div className="card-header">
                <h5 className="card-title mb-0">에디터 초대 요청</h5>
            </div>
            <div className="card-body">
                {invitationList.length === 0 ? (
                    <div className="alert alert-info">
                        현재 받은 초대 요청이 없습니다.
                    </div>
                ) : (
                    invitationList.map((invitation) => (
                        <div key={invitation.id} className="card mb-3">
                            <div className="card-body">
                                <div className="d-flex justify-content-between align-items-center mb-3">
                                    <div className="d-flex align-items-center gap-2">
                                        <img
                                            src={invitation.senderImage}
                                            alt="Profile"
                                            style={{
                                                width: '56px',
                                                height: '56px',
                                                borderRadius: '50%',
                                                objectFit: 'cover'
                                            }}
                                        />
                                        <div>
                                            <div className="fw-bold">{invitation.sender}</div>
                                            <div className="text-muted small">{invitation.createdDate}</div>
                                        </div>
                                    </div>
                                    <div className="d-flex gap-1">
                                        <button
                                            type="button"
                                            className="btn btn-outline-secondary btn-sm"
                                            onClick={() => respondToInvitation(invitation.id, 'reject')}>
                                            거절
                                        </button>
                                        <button
                                            type="button"
                                            className="btn btn-success btn-sm"
                                            onClick={() => respondToInvitation(invitation.id, 'accept')}>
                                            승낙
                                        </button>
                                    </div>
                                </div>
                                <div className="mb-0">
                                    <textarea
                                        className="form-control"
                                        readOnly
                                        rows={3}
                                        value={invitation.content}
                                    />
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default InvitationManagement;
