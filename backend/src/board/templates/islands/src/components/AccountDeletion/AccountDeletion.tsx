import React, { useState } from 'react';
import { http } from '~/modules/http.module';
import { notification } from '@baejino/ui';

const AccountDeletion = () => {
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            if (!password) {
                notification('비밀번호를 입력해주세요.', {
                    type: 'error'
                });
                setIsLoading(false);
                return;
            }

            const { data } = await http('v1/setting/account', {
                method: 'DELETE',
                data: { password }
            });

            if (data.status === 'DONE') {
                notification('계정이 삭제되었습니다.', {
                    type: 'success'
                });
                // Redirect to home page after account deletion
                window.location.href = '/';
            } else {
                notification(data.message || '계정 삭제에 실패했습니다.', {
                    type: 'error'
                });
            }
        } catch (error) {
            notification('계정 삭제에 실패했습니다.', {
                type: 'error'
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="account-deletion">
            {!isConfirmOpen ? (
                <div className="warning-section">
                    <p className="warning-text">
                        계정을 삭제하면 모든 데이터가 영구적으로 삭제됩니다. 이 작업은 되돌릴 수 없습니다.
                    </p>
                    <button
                        type="button"
                        className="btn btn-danger"
                        onClick={() => setIsConfirmOpen(true)}
                    >
                        계정 삭제
                    </button>
                </div>
            ) : (
                <div className="confirm-section">
                    <div className="alert alert-danger">
                        <strong>주의!</strong> 계정을 삭제하면 다음 데이터가 모두 삭제됩니다:
                        <ul className="deletion-list">
                            <li>모든 포스트 및 댓글</li>
                            <li>모든 시리즈</li>
                            <li>프로필 정보</li>
                            <li>모든 통계 데이터</li>
                        </ul>
                        이 작업은 되돌릴 수 없습니다.
                    </div>

                    <form onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label htmlFor="password" className="form-label">비밀번호 확인</label>
                            <input
                                id="password"
                                type="password"
                                className="form-control"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="현재 비밀번호"
                            />
                        </div>

                        <div className="form-actions">
                            <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={() => {
                                    setIsConfirmOpen(false);
                                    setPassword('');
                                }}
                                disabled={isLoading}
                            >
                                취소
                            </button>
                            <button
                                type="submit"
                                className="btn btn-danger"
                                disabled={isLoading}
                            >
                                {isLoading ? '처리 중...' : '계정 영구 삭제'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            <style jsx>{`
                .account-deletion {
                    margin-top: 8px;
                }

                .warning-section {
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                }

                .warning-text {
                    color: #721c24;
                }

                .confirm-section {
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                }

                .deletion-list {
                    margin-top: 8px;
                    margin-bottom: 8px;
                    padding-left: 20px;
                }

                .form-actions {
                    display: flex;
                    gap: 8px;
                    justify-content: flex-end;
                    margin-top: 16px;
                }
            `}</style>
        </div>
    );
};

export default AccountDeletion;
