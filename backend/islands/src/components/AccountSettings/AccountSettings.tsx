import React, { useState } from 'react';
import { http } from '~/modules/http.module';
import { notification } from '@baejino/ui';

interface AccountSettingsProps {
    username: string;
    name: string;
    email: string;
    createdDate: string;
    has2fa: boolean;
}

const AccountSettings: React.FC<AccountSettingsProps> = ({
    username: initialUsername,
    name: initialName,
    email,
    createdDate,
    has2fa
}) => {
    const [username, setUsername] = useState(initialUsername);
    const [name, setName] = useState(initialName);
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isEditingUsername, setIsEditingUsername] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const handleUsernameEdit = () => {
        setIsEditingUsername(true);
    };

    const handleUsernameCancel = () => {
        setIsEditingUsername(false);
        setUsername(initialUsername);
    };

    const handleUsernameSubmit = async () => {
        if (username === initialUsername) {
            setIsEditingUsername(false);
            return;
        }

        setIsLoading(true);
        try {
            const formData = new FormData();
            formData.append('update_username', '1');
            formData.append('username', username);

            const { data } = await http('settings/account', {
                method: 'POST',
                data: formData
            });

            if (data.success || data.status === 'DONE') {
                notification('아이디가 변경되었습니다.', { type: 'success' });
                setIsEditingUsername(false);
            } else {
                notification(data.message || '아이디 변경에 실패했습니다.', { type: 'error' });
                setUsername(initialUsername);
            }
        } catch (error) {
            notification('네트워크 오류가 발생했습니다.', { type: 'error' });
            setUsername(initialUsername);
        } finally {
            setIsLoading(false);
        }
    };

    const handleNameSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            const formData = new FormData();
            formData.append('update_name', '1');
            formData.append('name', name);

            const { data } = await http('settings/account', {
                method: 'POST',
                data: formData
            });

            if (data.success || data.status === 'DONE') {
                notification('이름이 업데이트되었습니다.', { type: 'success' });
            } else {
                notification('이름 업데이트에 실패했습니다.', { type: 'error' });
            }
        } catch (error) {
            notification('네트워크 오류가 발생했습니다.', { type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    const handlePasswordSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!newPassword || !confirmPassword) {
            notification('모든 비밀번호 필드를 입력해주세요.', { type: 'error' });
            return;
        }

        if (newPassword !== confirmPassword) {
            notification('비밀번호가 일치하지 않습니다.', { type: 'error' });
            return;
        }

        if (newPassword.length < 8) {
            notification('비밀번호는 8자 이상이어야 합니다.', { type: 'error' });
            return;
        }

        setIsLoading(true);
        try {
            const formData = new FormData();
            formData.append('update_password', '1');
            formData.append('new_password', newPassword);
            formData.append('confirm_password', confirmPassword);

            const { data } = await http('settings/account', {
                method: 'POST',
                data: formData
            });

            if (data.success || data.status === 'DONE') {
                notification('비밀번호가 변경되었습니다.', { type: 'success' });
                setNewPassword('');
                setConfirmPassword('');
            } else {
                notification('비밀번호 변경에 실패했습니다.', { type: 'error' });
            }
        } catch (error) {
            notification('네트워크 오류가 발생했습니다.', { type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    const handle2FA = async (enable: boolean) => {
        if (!enable && !confirm('정말 2차 인증을 해제할까요?')) {
            return;
        }

        try {
            const { data } = await http('v1/auth/security', {
                method: enable ? 'POST' : 'DELETE'
            });

            if (data.status === 'DONE') {
                notification(`2차 인증이 ${enable ? '활성화' : '해제'}되었습니다.`, { type: 'success' });
                setTimeout(() => location.reload(), 1000);
            } else {
                notification(`2차 인증 ${enable ? '활성화' : '해제'}에 실패했습니다.`, { type: 'error' });
            }
        } catch (error) {
            notification('네트워크 오류가 발생했습니다.', { type: 'error' });
        }
    };

    return (
        <div className="account-settings">
            {/* 가입일 */}
            <div className="setting-card">
                <div className="setting-card-title">가입일</div>
                <p className="mb-0">{createdDate}</p>
            </div>

            {/* 사용자 필명 */}
            <div className="setting-card">
                <div className="d-flex justify-content-between align-items-center mb-3">
                    <div className="setting-card-title">사용자 필명</div>
                    <div>
                        {!isEditingUsername ? (
                            <button type="button" className="btn btn-primary" onClick={handleUsernameEdit}>
                                변경
                            </button>
                        ) : (
                            <>
                                <button
                                    type="button"
                                    className="btn btn-primary me-2"
                                    onClick={handleUsernameSubmit}
                                    disabled={isLoading}
                                >
                                    업데이트
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-secondary"
                                    onClick={handleUsernameCancel}
                                    disabled={isLoading}
                                >
                                    취소
                                </button>
                            </>
                        )}
                    </div>
                </div>
                <div className="alert alert-warning mb-3">
                    사용자의 필명은 로그인시 사용되며 주소(URL)에 표기되는 이름입니다.
                    작성한 포스트가 존재하는 경우 6개월에 한번만 변경할 수 있습니다.
                </div>
                {!isEditingUsername ? (
                    <div>{username}</div>
                ) : (
                    <input
                        type="text"
                        className="form-control"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                    />
                )}
            </div>

            {/* 사용자 이름 */}
            <form onSubmit={handleNameSubmit}>
                <div className="setting-card">
                    <div className="d-flex justify-content-between align-items-center mb-3">
                        <div className="setting-card-title">사용자 이름</div>
                        <button type="submit" className="btn btn-primary" disabled={isLoading}>
                            업데이트
                        </button>
                    </div>
                    <input
                        type="text"
                        className="form-control"
                        placeholder="사용자 실명"
                        maxLength={30}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                    />
                </div>
            </form>

            {/* 이메일 */}
            <div className="setting-card">
                <div className="setting-card-title">이메일</div>
                <p className="mb-0">{email}</p>
            </div>

            {/* 비밀번호 변경 */}
            <form onSubmit={handlePasswordSubmit}>
                <div className="setting-card">
                    <div className="d-flex justify-content-between align-items-center mb-3">
                        <div className="setting-card-title">비밀번호 변경</div>
                        <button type="submit" className="btn btn-primary" disabled={isLoading}>
                            업데이트
                        </button>
                    </div>
                    <div className="alert alert-warning mb-3">
                        비밀번호는 8자 이상, 소문자, 대문자, 숫자, 특수문자를 포함해야 합니다.
                    </div>
                    <div className="form-group mb-3">
                        <input
                            type="password"
                            className="form-control"
                            placeholder="새 비밀번호"
                            maxLength={200}
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                        />
                    </div>
                    <div className="form-group">
                        <input
                            type="password"
                            className="form-control"
                            placeholder="비밀번호 확인"
                            maxLength={200}
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                        />
                    </div>
                </div>
            </form>

            {/* 2FA 및 계정 삭제 */}
            <div style={{ textAlign: 'right', marginBottom: '24px' }}>
                {has2fa ? (
                    <button
                        type="button"
                        className="btn btn-danger me-2"
                        onClick={() => handle2FA(false)}
                    >
                        2차 인증 중지
                    </button>
                ) : (
                    <button
                        type="button"
                        className="btn btn-primary me-2"
                        onClick={() => handle2FA(true)}
                    >
                        2차 인증 활성화
                    </button>
                )}
                <button
                    type="button"
                    className="btn btn-danger"
                    onClick={() => notification('계정 삭제 기능을 구현 중입니다.', { type: 'info' })}
                >
                    계정 삭제
                </button>
            </div>
        </div>
    );
};

export default AccountSettings;
