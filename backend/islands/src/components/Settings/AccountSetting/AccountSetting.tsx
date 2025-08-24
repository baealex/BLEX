import React, { useState, useEffect } from 'react';
import { http, type Response } from '~/modules/http.module';
import { notification } from '@baejino/ui';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

interface AccountData {
    username: string;
    name: string;
    email: string;
    createdDate: string;
    has2fa: boolean;
}

// Zod schema for username form
const usernameSchema = z.object({ username: z.string().min(3, '아이디는 3자 이상이어야 합니다.').max(30, '아이디는 30자 이내여야 합니다.') });

// Zod schema for name form
const nameSchema = z.object({ name: z.string().max(30, '이름은 30자 이내여야 합니다.').optional() });

// Zod schema for password form
const passwordSchema = z.object({
    newPassword: z.string()
        .min(8, '비밀번호는 8자 이상이어야 합니다.')
        .regex(/[a-z]/, '비밀번호는 소문자를 포함해야 합니다.')
        .regex(/[A-Z]/, '비밀번호는 대문자를 포함해야 합니다.')
        .regex(/[0-9]/, '비밀번호는 숫자를 포함해야 합니다.')
        .regex(/[^a-zA-Z0-9]/, '비밀번호는 특수문자를 포함해야 합니다.'),
    confirmPassword: z.string()
}).refine((data) => data.newPassword === data.confirmPassword, {
    message: '비밀번호가 일치하지 않습니다.',
    path: ['confirmPassword']
});

type UsernameFormInputs = z.infer<typeof usernameSchema>;
type NameFormInputs = z.infer<typeof nameSchema>;
type PasswordFormInputs = z.infer<typeof passwordSchema>;

interface AccountData {
    username: string;
    name: string;
    email: string;
    createdDate: string;
    has2fa: boolean;
}

const AccountSettings: React.FC = () => {
    const [createdDate, setCreatedDate] = useState('');
    const [email, setEmail] = useState('');
    const [has2fa, setHas2fa] = useState(false);

    const [isLoading, setIsLoading] = useState(false);

    // Forms
    const { register: registerUsername, handleSubmit: handleUsernameSubmit, reset: resetUsername, formState: { errors: errorsUsername } } = useForm<UsernameFormInputs>({ resolver: zodResolver(usernameSchema) });
    const { register: registerName, handleSubmit: handleNameSubmit, reset: resetName, formState: { errors: errorsName } } = useForm<NameFormInputs>({ resolver: zodResolver(nameSchema) });
    const { register: registerPassword, handleSubmit: handlePasswordSubmit, reset: resetPassword, formState: { errors: errorsPassword } } = useForm<PasswordFormInputs>({ resolver: zodResolver(passwordSchema) });

    // Fetch initial data
    useEffect(() => {
        const fetchAccountData = async () => {
            try {
                const { data } = await http<Response<AccountData>>('v1/setting/account', { method: 'GET' });
                if (data.status === 'DONE') {
                    resetUsername({ username: data.body.username });
                    resetName({ name: data.body.name });
                    setEmail(data.body.email);
                    setCreatedDate(data.body.createdDate);
                    setHas2fa(data.body.has2fa);
                } else {
                    notification('계정 정보를 불러오는데 실패했습니다.', { type: 'error' });
                }
            } catch (error) {
                notification('계정 정보를 불러오는데 실패했습니다.', { type: 'error' });
            }
        };
        fetchAccountData();
    }, [resetUsername, resetName]);

    const onSubmitUsername = async (formData: UsernameFormInputs) => {
        setIsLoading(true);
        try {
            const dataToSend = new FormData();
            dataToSend.append('update_username', '1');
            dataToSend.append('username', formData.username);

            const { data } = await http('settings/account', { // Still using old endpoint for username
                method: 'POST',
                data: dataToSend
            });

            if (data.success || data.status === 'DONE') {
                notification('아이디가 변경되었습니다.', { type: 'success' });
            } else {
                notification(data.message || '아이디 변경에 실패했습니다.', { type: 'error' });
            }
        } catch (error) {
            notification('네트워크 오류가 발생했습니다.', { type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    const onSubmitName = async (formData: NameFormInputs) => {
        setIsLoading(true);
        try {
            const { data } = await http('v1/setting/account', {
                method: 'PUT',
                data: { name: formData.name }
            });

            if (data.status === 'DONE') {
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

    const onSubmitPassword = async (formData: PasswordFormInputs) => {
        setIsLoading(true);
        try {
            const { data } = await http('v1/setting/account', {
                method: 'PUT',
                data: { password: formData.newPassword }
            });

            if (data.status === 'DONE') {
                notification('비밀번호가 변경되었습니다.', { type: 'success' });
                resetPassword({
                    newPassword: '',
                    confirmPassword: ''
                });
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
            const { data } = await http('v1/auth/security', { method: enable ? 'POST' : 'DELETE' });

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
        <div className="space-y-6">
            {/* 가입일 */}
            <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
                <h3 className="text-xl font-semibold text-gray-800 mb-4">가입일</h3>
                <p className="text-gray-700">{createdDate}</p>
            </div>

            {/* 사용자 필명 */}
            <form onSubmit={handleUsernameSubmit(onSubmitUsername)}>
                <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-xl font-semibold text-gray-800">사용자 필명</h3>
                        <div>
                            <button
                                type="submit"
                                className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 mr-2"
                                disabled={isLoading}>
                                업데이트
                            </button>
                        </div>
                    </div>
                    <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-md text-sm mb-4">
                        사용자의 필명은 로그인시 사용되며 주소(URL)에 표기되는 이름입니다.
                        작성한 포스트가 존재하는 경우 6개월에 한번만 변경할 수 있습니다.
                    </div>
                    <input
                        type="text"
                        className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        placeholder="사용자 필명"
                        maxLength={30}
                        {...registerUsername('username')}
                    />
                    {errorsUsername.username && <p className="text-danger">{errorsUsername.username.message}</p>}
                </div>
            </form>

            {/* 사용자 이름 */}
            <form onSubmit={handleNameSubmit(onSubmitName)}>
                <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-xl font-semibold text-gray-800">사용자 이름</h3>
                        <button type="submit" className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500" disabled={isLoading}>
                            업데이트
                        </button>
                    </div>
                    <input
                        type="text"
                        className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        placeholder="사용자 실명"
                        maxLength={30}
                        {...registerName('name')}
                    />
                    {errorsName.name && <p className="text-danger">{errorsName.name.message}</p>}
                </div>
            </form>

            {/* 이메일 */}
            <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
                <h3 className="text-xl font-semibold text-gray-800 mb-4">이메일</h3>
                <p className="text-gray-700">{email}</p>
            </div>

            {/* 비밀번호 변경 */}
            <form onSubmit={handlePasswordSubmit(onSubmitPassword)}>
                <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-xl font-semibold text-gray-800">비밀번호 변경</h3>
                        <button type="submit" className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500" disabled={isLoading}>
                            업데이트
                        </button>
                    </div>
                    <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-md text-sm mb-4">
                        비밀번호는 8자 이상, 소문자, 대문자, 숫자, 특수문자를 포함해야 합니다.
                    </div>
                    <div className="mb-4">
                        <input
                            type="password"
                            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                            placeholder="새 비밀번호"
                            maxLength={200}
                            {...registerPassword('newPassword')}
                        />
                        {errorsPassword.newPassword && <p className="text-danger">{errorsPassword.newPassword.message}</p>}
                    </div>
                    <div>
                        <input
                            type="password"
                            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                            placeholder="비밀번호 확인"
                            maxLength={200}
                            {...registerPassword('confirmPassword')}
                        />
                        {errorsPassword.confirmPassword && <p className="text-danger">{errorsPassword.confirmPassword.message}</p>}
                    </div>
                </div>
            </form>

            {/* 2FA 및 계정 삭제 */}
            <div className="flex justify-end mt-6">
                {has2fa ? (
                    <button
                        type="button"
                        className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 mr-2"
                        onClick={() => handle2FA(false)}>
                        2차 인증 중지
                    </button>
                ) : (
                    <button
                        type="button"
                        className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 mr-2"
                        onClick={() => handle2FA(true)}>
                        2차 인증 활성화
                    </button>
                )}
                <button
                    type="button"
                    className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                    onClick={() => notification('계정 삭제 기능을 구현 중입니다.', { type: 'info' })}>
                    계정 삭제
                </button>
            </div>
        </div>
    );
};

export default AccountSettings;
