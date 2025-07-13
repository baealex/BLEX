import React, { useState } from 'react';
import { http } from '~/modules/http.module';
import { notification } from '@baejino/ui';

interface AccountInfoProps {
    username: string;
    email: string;
}

const AccountInfo: React.FC<AccountInfoProps> = ({ username: initialUsername, email: initialEmail }) => {
    const [username, setUsername] = useState(initialUsername);
    const [email, setEmail] = useState(initialEmail);
    const [isLoading, setIsLoading] = useState(false);
    const [isEditingUsername, setIsEditingUsername] = useState(false);
    const [isEditingEmail, setIsEditingEmail] = useState(false);

    const handleUsernameSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            if (!username.trim()) {
                notification('사용자 이름을 입력해주세요.', {
                    type: 'error'
                });
                setIsLoading(false);
                return;
            }

            const { data } = await http('v1/setting/username', {
                method: 'PUT',
                data: { username }
            });

            if (data.status === 'DONE') {
                notification('사용자 이름이 업데이트 되었습니다.', {
                    type: 'success'
                });
                setIsEditingUsername(false);
            } else {
                notification(data.message || '사용자 이름 업데이트에 실패했습니다.', {
                    type: 'error'
                });
            }
        } catch (error) {
            notification('사용자 이름 업데이트에 실패했습니다.', {
                type: 'error'
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleEmailSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            if (!email.trim()) {
                notification('이메일을 입력해주세요.', {
                    type: 'error'
                });
                setIsLoading(false);
                return;
            }

            const { data } = await http('v1/setting/email', {
                method: 'PUT',
                data: { email }
            });

            if (data.status === 'DONE') {
                notification('이메일이 업데이트 되었습니다.', {
                    type: 'success'
                });
                setIsEditingEmail(false);
            } else {
                notification(data.message || '이메일 업데이트에 실패했습니다.', {
                    type: 'error'
                });
            }
        } catch (error) {
            notification('이메일 업데이트에 실패했습니다.', {
                type: 'error'
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="account-info">
            <div className="info-section">
                <div className="info-header">
                    <h3 className="info-title">사용자 이름</h3>
                    {!isEditingUsername && (
                        <button
                            type="button"
                            className="btn-edit"
                            onClick={() => setIsEditingUsername(true)}
                        >
                            <i className="fas fa-edit"></i> 수정
                        </button>
                    )}
                </div>

                {isEditingUsername ? (
                    <form onSubmit={handleUsernameSubmit} className="edit-form">
                        <div className="form-group">
                            <input
                                type="text"
                                className="form-control"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                placeholder="사용자 이름"
                            />
                            <p className="form-help">사용자 이름은 공백 없이 영문, 숫자, 밑줄(_)만 사용할 수 있습니다.</p>
                        </div>
                        <div className="form-actions">
                            <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={() => {
                                    setUsername(initialUsername);
                                    setIsEditingUsername(false);
                                }}
                                disabled={isLoading}
                            >
                                취소
                            </button>
                            <button
                                type="submit"
                                className="btn btn-primary"
                                disabled={isLoading}
                            >
                                {isLoading ? '저장 중...' : '저장'}
                            </button>
                        </div>
                    </form>
                ) : (
                    <p className="info-value">{username}</p>
                )}
            </div>

            <div className="info-section">
                <div className="info-header">
                    <h3 className="info-title">이메일</h3>
                    {!isEditingEmail && (
                        <button
                            type="button"
                            className="btn-edit"
                            onClick={() => setIsEditingEmail(true)}
                        >
                            <i className="fas fa-edit"></i> 수정
                        </button>
                    )}
                </div>

                {isEditingEmail ? (
                    <form onSubmit={handleEmailSubmit} className="edit-form">
                        <div className="form-group">
                            <input
                                type="email"
                                className="form-control"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="이메일"
                            />
                            <p className="form-help">이메일 변경 시 인증 메일이 발송됩니다.</p>
                        </div>
                        <div className="form-actions">
                            <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={() => {
                                    setEmail(initialEmail);
                                    setIsEditingEmail(false);
                                }}
                                disabled={isLoading}
                            >
                                취소
                            </button>
                            <button
                                type="submit"
                                className="btn btn-primary"
                                disabled={isLoading}
                            >
                                {isLoading ? '저장 중...' : '저장'}
                            </button>
                        </div>
                    </form>
                ) : (
                    <p className="info-value">{email}</p>
                )}
            </div>

            <style jsx>{`
                .account-info {
                    display: flex;
                    flex-direction: column;
                    gap: 24px;
                }

                .info-section {
                    border-bottom: 1px solid #e0e0e0;
                    padding-bottom: 16px;
                }

                .info-section:last-child {
                    border-bottom: none;
                }

                .info-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 8px;
                }

                .info-title {
                    font-size: 16px;
                    font-weight: 600;
                    margin: 0;
                }

                .info-value {
                    font-size: 16px;
                    margin: 0;
                }

                .btn-edit {
                    background: none;
                    border: none;
                    color: #4568dc;
                    cursor: pointer;
                    padding: 4px 8px;
                    font-size: 14px;
                }

                .edit-form {
                    margin-top: 16px;
                }

                .form-help {
                    font-size: 12px;
                    color: #6c757d;
                    margin-top: 4px;
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

export default AccountInfo;
