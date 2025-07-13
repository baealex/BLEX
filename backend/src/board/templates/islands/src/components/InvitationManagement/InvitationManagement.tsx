import React, { useState, useEffect } from 'react';
import { http } from '~/modules/http.module';
import { notification } from '@baejino/ui';

interface Invitation {
    id: string;
    code: string;
    created: string;
    expires: string;
    used: boolean;
    usedBy?: {
        username: string;
        displayName: string;
    };
}

const InvitationManagement: React.FC = () => {
    const [invitations, setInvitations] = useState<Invitation[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isGenerating, setIsGenerating] = useState(false);

    useEffect(() => {
        fetchInvitations();
    }, []);

    const fetchInvitations = async () => {
        setIsLoading(true);

        try {
            const { data } = await http<{ status: string; body: Invitation[] }>('v1/setting/invitations', {
                method: 'GET'
            });

            if (data.status === 'DONE') {
                setInvitations(data.body);
            } else {
                notification('초대 코드를 불러오는데 실패했습니다.', { type: 'error' });
            }
        } catch (error) {
            notification('초대 코드를 불러오는데 실패했습니다.', { type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    const generateInvitation = async () => {
        setIsGenerating(true);

        try {
            const { data } = await http<{ status: string; body: Invitation }>('v1/setting/invitations', {
                method: 'POST'
            });

            if (data.status === 'DONE') {
                setInvitations(prev => [data.body, ...prev]);
                notification('새로운 초대 코드가 생성되었습니다.', { type: 'success' });
            } else {
                notification('초대 코드 생성에 실패했습니다.', { type: 'error' });
            }
        } catch (error) {
            notification('초대 코드 생성에 실패했습니다.', { type: 'error' });
        } finally {
            setIsGenerating(false);
        }
    };

    const deleteInvitation = async (id: string) => {
        if (!confirm('이 초대 코드를 삭제하시겠습니까?')) {
            return;
        }

        try {
            const { data } = await http(`v1/setting/invitations/${id}`, {
                method: 'DELETE'
            });

            if (data.status === 'DONE') {
                setInvitations(prev => prev.filter(invitation => invitation.id !== id));
                notification('초대 코드가 삭제되었습니다.', { type: 'success' });
            } else {
                notification('초대 코드 삭제에 실패했습니다.', { type: 'error' });
            }
        } catch (error) {
            notification('초대 코드 삭제에 실패했습니다.', { type: 'error' });
        }
    };

    const copyToClipboard = (code: string) => {
        navigator.clipboard.writeText(`${window.location.origin}/join?code=${code}`);
        notification('초대 링크가 클립보드에 복사되었습니다.', { type: 'success' });
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('ko-KR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const isExpired = (expiresDate: string) => {
        return new Date(expiresDate) < new Date();
    };

    return (
        <div className="invitation-management">
            <div className="invitation-header">
                <h3 className="invitation-title">초대 코드 관리</h3>
                <button
                    className="btn btn-primary"
                    onClick={generateInvitation}
                    disabled={isGenerating}
                >
                    {isGenerating ? '생성 중...' : '새 초대 코드 생성'}
                </button>
            </div>

            <div className="invitation-info">
                <p>
                    초대 코드를 생성하여 다른 사용자를 초대할 수 있습니다.
                    각 초대 코드는 생성 후 7일간 유효하며, 한 번만 사용할 수 있습니다.
                </p>
            </div>

            {isLoading && invitations.length === 0 ? (
                <div className="loading-state">
                    <p>초대 코드를 불러오는 중...</p>
                </div>
            ) : invitations.length === 0 ? (
                <div className="empty-state">
                    <p>생성된 초대 코드가 없습니다.</p>
                </div>
            ) : (
                <div className="invitations-list">
                    {invitations.map(invitation => (
                        <div
                            key={invitation.id}
                            className={`invitation-item ${invitation.used || isExpired(invitation.expires) ? 'disabled' : ''}`}
                        >
                            <div className="invitation-code">
                                <span className="code">{invitation.code}</span>
                                <button
                                    className="btn-copy"
                                    onClick={() => copyToClipboard(invitation.code)}
                                    disabled={invitation.used || isExpired(invitation.expires)}
                                >
                                    <i className="far fa-copy"></i>
                                </button>
                            </div>
                            <div className="invitation-details">
                                <div className="detail-row">
                                    <span className="detail-label">생성일:</span>
                                    <span className="detail-value">{formatDate(invitation.created)}</span>
                                </div>
                                <div className="detail-row">
                                    <span className="detail-label">만료일:</span>
                                    <span className="detail-value">
                                        {formatDate(invitation.expires)}
                                        {isExpired(invitation.expires) && !invitation.used && (
                                            <span className="status expired">만료됨</span>
                                        )}
                                    </span>
                                </div>
                                <div className="detail-row">
                                    <span className="detail-label">상태:</span>
                                    <span className="detail-value">
                                        {invitation.used ? (
                                            <span className="status used">
                                                사용됨 - {invitation.usedBy?.displayName} (@{invitation.usedBy?.username})
                                            </span>
                                        ) : isExpired(invitation.expires) ? (
                                            <span className="status expired">만료됨</span>
                                        ) : (
                                            <span className="status active">활성</span>
                                        )}
                                    </span>
                                </div>
                            </div>
                            <div className="invitation-actions">
                                <button
                                    className="btn btn-icon btn-danger"
                                    onClick={() => deleteInvitation(invitation.id)}
                                >
                                    <i className="fas fa-trash"></i>
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <style jsx>{`
        .invitation-management {
          position: relative;
        }

        .invitation-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }

        .invitation-title {
          margin: 0;
          font-size: 18px;
        }

        .invitation-info {
          margin-bottom: 24px;
          padding: 12px 16px;
          background-color: #f8f9fa;
          border-radius: 8px;
          border-left: 4px solid #4568dc;
        }

        .invitation-info p {
          margin: 0;
          font-size: 14px;
          color: #495057;
        }

        .loading-state,
        .empty-state {
          padding: 40px 0;
          text-align: center;
          color: #6c757d;
        }

        .invitations-list {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .invitation-item {
          display: flex;
          flex-direction: column;
          gap: 12px;
          padding: 16px;
          background-color: #f8f9fa;
          border-radius: 8px;
        }

        @media (min-width: 768px) {
          .invitation-item {
            flex-direction: row;
            align-items: center;
          }
        }

        .invitation-item.disabled {
          opacity: 0.7;
        }

        .invitation-code {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          background-color: #e9ecef;
          border-radius: 4px;
          font-family: monospace;
          font-size: 16px;
          min-width: 180px;
        }

        .code {
          flex: 1;
        }

        .btn-copy {
          background: none;
          border: none;
          color: #6c757d;
          cursor: pointer;
          padding: 4px;
        }

        .btn-copy:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .invitation-details {
          flex: 1;
        }

        .detail-row {
          display: flex;
          flex-wrap: wrap;
          margin-bottom: 4px;
          font-size: 14px;
        }

        .detail-label {
          min-width: 70px;
          font-weight: 600;
          margin-right: 8px;
        }

        .detail-value {
          color: #495057;
        }

        .status {
          display: inline-block;
          padding: 2px 6px;
          border-radius: 12px;
          font-size: 12px;
          margin-left: 8px;
        }

        .status.active {
          background-color: #d4edda;
          color: #155724;
        }

        .status.expired {
          background-color: #f8d7da;
          color: #721c24;
        }

        .status.used {
          background-color: #cce5ff;
          color: #004085;
        }

        .invitation-actions {
          display: flex;
          justify-content: flex-end;
        }

        .btn-icon {
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 4px;
          background-color: #fff;
          border: 1px solid #ced4da;
          color: #495057;
          cursor: pointer;
        }

        .btn-icon.btn-danger {
          color: #dc3545;
        }
      `}</style>
        </div>
    );
};

export default InvitationManagement;
