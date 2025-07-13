import React, { useState } from 'react';
import { http } from '~/modules/http.module';
import { notification } from '@baejino/ui';

interface PasswordFormData {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
}

const PasswordChange = () => {
    const [formData, setFormData] = useState<PasswordFormData>({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
    });
    const [isLoading, setIsLoading] = useState(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            const { currentPassword, newPassword, confirmPassword } = formData;

            if (!currentPassword || !newPassword || !confirmPassword) {
                notification('모든 필드를 입력해주세요.', {
                    type: 'error'
                });
                setIsLoading(false);
                return;
            }

            if (newPassword !== confirmPassword) {
                notification('새 비밀번호가 일치하지 않습니다.', {
                    type: 'error'
                });
                setIsLoading(false);
                return;
            }

            if (newPassword.length < 8) {
                notification('비밀번호는 최소 8자 이상이어야 합니다.', {
                    type: 'error'
                });
                setIsLoading(false);
                return;
            }

            const { data } = await http('v1/setting/password', {
                method: 'PUT',
                data: {
                    current_password: currentPassword,
                    new_password: newPassword
                }
            });

            if (data.status === 'DONE') {
                notification('비밀번호가 변경되었습니다.', {
                    type: 'success'
                });
                setFormData({
                    currentPassword: '',
                    newPassword: '',
                    confirmPassword: ''
                });
            } else {
                notification(data.message || '비밀번호 변경에 실패했습니다.', {
                    type: 'error'
                });
            }
        } catch (error) {
            notification('비밀번호 변경에 실패했습니다.', {
                type: 'error'
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="password-change">
            <form onSubmit={handleSubmit}>
                <div className="form-group">
                    <label htmlFor="currentPassword" className="form-label">현재 비밀번호</label>
                    <input
                        id="currentPassword"
                        name="currentPassword"
                        type="password"
                        className="form-control"
                        value={formData.currentPassword}
                        onChange={handleChange}
                        placeholder="현재 비밀번호"
                    />
                </div>

                <div className="form-group">
                    <label htmlFor="newPassword" className="form-label">새 비밀번호</label>
                    <input
                        id="newPassword"
                        name="newPassword"
                        type="password"
                        className="form-control"
                        value={formData.newPassword}
                        onChange={handleChange}
                        placeholder="새 비밀번호"
                    />
                    <p className="form-help">비밀번호는 최소 8자 이상이어야 합니다.</p>
                </div>

                <div className="form-group">
                    <label htmlFor="confirmPassword" className="form-label">새 비밀번호 확인</label>
                    <input
                        id="confirmPassword"
                        name="confirmPassword"
                        type="password"
                        className="form-control"
                        value={formData.confirmPassword}
                        onChange={handleChange}
                        placeholder="새 비밀번호 확인"
                    />
                </div>

                <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={isLoading}
                >
                    {isLoading ? '변경 중...' : '비밀번호 변경'}
                </button>
            </form>

            <style jsx>{`
                .password-change {
                    margin-top: 8px;
                }

                .form-help {
                    font-size: 12px;
                    color: #6c757d;
                    margin-top: 4px;
                }
            `}</style>
        </div>
    );
};

export default PasswordChange;
