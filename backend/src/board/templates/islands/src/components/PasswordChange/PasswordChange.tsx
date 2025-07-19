import React, { useState } from 'react';
import { http } from '~/modules/http.module';
import { notification } from '@baejino/ui';

interface PasswordFormData {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
}

interface ValidationErrors {
    currentPassword?: string;
    newPassword?: string;
    confirmPassword?: string;
}

const PasswordChange = () => {
    const [formData, setFormData] = useState<PasswordFormData>({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
    });
    const [errors, setErrors] = useState<ValidationErrors>({});
    const [isLoading, setIsLoading] = useState(false);
    const [passwordStrength, setPasswordStrength] = useState<'weak' | 'medium' | 'strong' | null>(null);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
        
        // Clear error when user starts typing
        if (errors[name as keyof ValidationErrors]) {
            setErrors(prev => ({
                ...prev,
                [name]: undefined
            }));
        }
        
        // Check password strength when new password changes
        if (name === 'newPassword') {
            checkPasswordStrength(value);
        }
        
        // Check password match when confirm password changes
        if (name === 'confirmPassword' && formData.newPassword) {
            if (value && value !== formData.newPassword) {
                setErrors(prev => ({
                    ...prev,
                    confirmPassword: '비밀번호가 일치하지 않습니다.'
                }));
            } else {
                setErrors(prev => ({
                    ...prev,
                    confirmPassword: undefined
                }));
            }
        }
    };
    
    const checkPasswordStrength = (password: string) => {
        if (!password) {
            setPasswordStrength(null);
            return;
        }
        
        // Check password strength
        const hasLetter = /[a-zA-Z]/.test(password);
        const hasNumber = /[0-9]/.test(password);
        const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);
        
        if (password.length < 8) {
            setPasswordStrength('weak');
        } else if (hasLetter && hasNumber && hasSpecial && password.length >= 10) {
            setPasswordStrength('strong');
        } else if ((hasLetter && hasNumber) || (hasLetter && hasSpecial) || (hasNumber && hasSpecial)) {
            setPasswordStrength('medium');
        } else {
            setPasswordStrength('weak');
        }
    };

    const validateForm = (): boolean => {
        const newErrors: ValidationErrors = {};
        const { currentPassword, newPassword, confirmPassword } = formData;
        
        if (!currentPassword) {
            newErrors.currentPassword = '현재 비밀번호를 입력해주세요.';
        }
        
        if (!newPassword) {
            newErrors.newPassword = '새 비밀번호를 입력해주세요.';
        } else if (newPassword.length < 8) {
            newErrors.newPassword = '비밀번호는 최소 8자 이상이어야 합니다.';
        }
        
        if (!confirmPassword) {
            newErrors.confirmPassword = '비밀번호 확인을 입력해주세요.';
        } else if (newPassword !== confirmPassword) {
            newErrors.confirmPassword = '비밀번호가 일치하지 않습니다.';
        }
        
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!validateForm()) {
            return;
        }
        
        setIsLoading(true);
        
        try {
            const { currentPassword, newPassword } = formData;

            const { data } = await http('v1/setting/password', {
                method: 'PUT',
                data: {
                    current_password: currentPassword,
                    new_password: newPassword
                }
            });

            if (data.status === 'DONE') {
                notification('비밀번호가 변경되었습니다.', { type: 'success' });
                setFormData({
                    currentPassword: '',
                    newPassword: '',
                    confirmPassword: ''
                });
            } else {
                notification(data.message || '비밀번호 변경에 실패했습니다.', { type: 'error' });
            }
        } catch (error) {
            notification('비밀번호 변경에 실패했습니다.', { type: 'error' });
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
                        className={`form-control ${errors.currentPassword ? 'error' : ''}`}
                        value={formData.currentPassword}
                        onChange={handleChange}
                        placeholder="현재 비밀번호"
                    />
                    {errors.currentPassword && (
                        <p className="form-error">{errors.currentPassword}</p>
                    )}
                </div>

                <div className="form-group">
                    <label htmlFor="newPassword" className="form-label">새 비밀번호</label>
                    <input
                        id="newPassword"
                        name="newPassword"
                        type="password"
                        className={`form-control ${errors.newPassword ? 'error' : ''}`}
                        value={formData.newPassword}
                        onChange={handleChange}
                        placeholder="새 비밀번호"
                    />
                    {errors.newPassword ? (
                        <p className="form-error">{errors.newPassword}</p>
                    ) : (
                        <div>
                            <p className="form-help">비밀번호는 최소 8자 이상이어야 합니다.</p>
                            {passwordStrength && (
                                <div className="password-strength">
                                    <div className="strength-label">비밀번호 강도:</div>
                                    <div className="strength-meter">
                                        <div
                                            className={`strength-value ${passwordStrength}`}
                                            style={{
                                                width: passwordStrength === 'weak' ? '33%' :
                                                    passwordStrength === 'medium' ? '66%' : '100%'
                                            }}
                                        />
                                    </div>
                                    <div className="strength-text">
                                        {passwordStrength === 'weak' ? '약함' :
                                            passwordStrength === 'medium' ? '중간' : '강함'}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="form-group">
                    <label htmlFor="confirmPassword" className="form-label">새 비밀번호 확인</label>
                    <input
                        id="confirmPassword"
                        name="confirmPassword"
                        type="password"
                        className={`form-control ${errors.confirmPassword ? 'error' : ''}`}
                        value={formData.confirmPassword}
                        onChange={handleChange}
                        placeholder="새 비밀번호 확인"
                    />
                    {errors.confirmPassword && (
                        <p className="form-error">{errors.confirmPassword}</p>
                    )}
                </div>

                <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={isLoading}>
                    {isLoading ? '변경 중...' : '비밀번호 변경'}
                </button>
            </form>

            <style jsx>{`
                .password-change {
                    margin-top: 8px;
                }

                .form-group {
                    margin-bottom: 20px;
                }

                .form-help {
                    font-size: 12px;
                    color: #6c757d;
                    margin-top: 4px;
                }

                .form-error {
                    font-size: 12px;
                    color: #dc3545;
                    margin-top: 4px;
                }

                .form-control.error {
                    border-color: #dc3545;
                }

                .form-control.error:focus {
                    box-shadow: 0 0 0 0.2rem rgba(220, 53, 69, 0.25);
                }

                .password-strength {
                    margin-top: 8px;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }

                .strength-label {
                    font-size: 12px;
                    color: #6c757d;
                }

                .strength-meter {
                    flex: 1;
                    height: 6px;
                    background-color: #e9ecef;
                    border-radius: 3px;
                    overflow: hidden;
                }

                .strength-value {
                    height: 100%;
                    border-radius: 3px;
                    transition: width 0.3s ease;
                }

                .strength-value.weak {
                    background-color: #dc3545;
                }

                .strength-value.medium {
                    background-color: #ffc107;
                }

                .strength-value.strong {
                    background-color: #28a745;
                }

                .strength-text {
                    font-size: 12px;
                    font-weight: 600;
                }

                .strength-text:empty {
                    display: none;
                }
            `}</style>
        </div>
    );
};

export default PasswordChange;
