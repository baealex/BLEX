import React, { useState } from 'react';
import { http, type Response } from '~/modules/http.module';
import { notification } from '@baejino/ui';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useFetch } from '~/hooks/use-fetch';
import { Button, Input, Card } from '~/components/shared';

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

const AccountSettings: React.FC = () => {
    const [isUsernameLoading, setIsUsernameLoading] = useState(false);
    const [isNameLoading, setIsNameLoading] = useState(false);
    const [isPasswordLoading, setIsPasswordLoading] = useState(false);

    // Forms
    const { register: registerUsername, handleSubmit: handleUsernameSubmit, reset: resetUsername, formState: { errors: errorsUsername } } = useForm<UsernameFormInputs>({ resolver: zodResolver(usernameSchema) });
    const { register: registerName, handleSubmit: handleNameSubmit, reset: resetName, formState: { errors: errorsName } } = useForm<NameFormInputs>({ resolver: zodResolver(nameSchema) });
    const { register: registerPassword, handleSubmit: handlePasswordSubmit, reset: resetPassword, formState: { errors: errorsPassword } } = useForm<PasswordFormInputs>({ resolver: zodResolver(passwordSchema) });

    const { data: accountData, isError, refetch } = useFetch({
        queryKey: ['account-setting'],
        queryFn: async () => {
            const { data } = await http<Response<AccountData>>('v1/setting/account', { method: 'GET' });
            if (data.status === 'DONE') {
                return data.body;
            }
            throw new Error('계정 정보를 불러오는데 실패했습니다.');
        }
    });

    React.useEffect(() => {
        if (accountData) {
            resetUsername({ username: accountData.username });
            resetName({ name: accountData.name });
        }
    }, [accountData, resetUsername, resetName]);

    React.useEffect(() => {
        if (isError) {
            notification('계정 정보를 불러오는데 실패했습니다.', { type: 'error' });
        }
    }, [isError]);

    const onSubmitUsername = async (formData: UsernameFormInputs) => {
        setIsUsernameLoading(true);
        try {
            const { data } = await http('v1/setting/account', {
                method: 'PUT',
                data: { username: formData.username }
            });

            if (data.status === 'DONE') {
                notification('아이디가 변경되었습니다.', { type: 'success' });
                refetch();
            } else {
                notification(data.errorMessage || '아이디 변경에 실패했습니다.', { type: 'error' });
            }
        } catch {
            notification('네트워크 오류가 발생했습니다.', { type: 'error' });
        } finally {
            setIsUsernameLoading(false);
        }
    };

    const onSubmitName = async (formData: NameFormInputs) => {
        setIsNameLoading(true);
        try {
            const { data } = await http('v1/setting/account', {
                method: 'PUT',
                data: { name: formData.name }
            });

            if (data.status === 'DONE') {
                notification('이름이 업데이트되었습니다.', { type: 'success' });
                refetch();
            } else {
                notification(data.errorMessage || '이름 업데이트에 실패했습니다.', { type: 'error' });
            }
        } catch {
            notification('네트워크 오류가 발생했습니다.', { type: 'error' });
        } finally {
            setIsNameLoading(false);
        }
    };

    const onSubmitPassword = async (formData: PasswordFormInputs) => {
        setIsPasswordLoading(true);
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
                refetch();
            } else {
                notification(data.errorMessage || '비밀번호 변경에 실패했습니다.', { type: 'error' });
            }
        } catch {
            notification('네트워크 오류가 발생했습니다.', { type: 'error' });
        } finally {
            setIsPasswordLoading(false);
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
        } catch {
            notification('네트워크 오류가 발생했습니다.', { type: 'error' });
        }
    };

    return (
        <div className="p-6 bg-white shadow-sm rounded-2xl border border-gray-200">
            {/* Header Section */}
            <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">계정 설정</h2>
                <p className="text-gray-600">아이디, 이름, 비밀번호 등 계정 정보를 관리하세요.</p>
            </div>

            {/* 가입일 */}
            <Card
                title="가입일"
                icon={
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                    </svg>
                }
                className="mb-6">
                <p className="text-gray-700 bg-white px-4 py-3 rounded-md border border-gray-200">{accountData?.createdDate}</p>
            </Card>

            {/* 사용자 필명 */}
            <form onSubmit={handleUsernameSubmit(onSubmitUsername)}>
                <Card
                    title="사용자 필명"
                    icon={
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-6-3a2 2 0 11-4 0 2 2 0 014 0zm-2 4a5 5 0 00-4.546 2.916A5.986 5.986 0 0010 16a5.986 5.986 0 004.546-2.084A5 5 0 0010 11z" clipRule="evenodd" />
                        </svg>
                    }
                    className="mb-6">
                    <div className="bg-yellow-50 border border-gray-300 text-gray-900 px-4 py-3 rounded-md text-sm mb-4 flex items-center">
                        <svg className="w-4 h-4 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        사용자의 필명은 로그인시 사용되며 주소(URL)에 표기되는 이름입니다. 작성한 포스트가 존재하는 경우 6개월에 한번만 변경할 수 있습니다.
                    </div>
                    <div className="mb-4">
                        <Input
                            type="text"
                            placeholder="사용자 필명"
                            maxLength={30}
                            error={errorsUsername.username?.message}
                            {...registerUsername('username')}
                        />
                    </div>
                    <Button
                        type="submit"
                        variant="primary"
                        size="md"
                        fullWidth
                        isLoading={isUsernameLoading}
                        leftIcon={
                            !isUsernameLoading ? (
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                            ) : undefined
                        }>
                        {isUsernameLoading ? '업데이트 중...' : '필명 업데이트'}
                    </Button>
                </Card>
            </form>

            {/* 사용자 이름 */}
            <form onSubmit={handleNameSubmit(onSubmitName)}>
                <Card
                    title="사용자 이름"
                    icon={
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                        </svg>
                    }
                    className="mb-6">
                    <div className="mb-4">
                        <Input
                            type="text"
                            placeholder="사용자 실명"
                            maxLength={30}
                            error={errorsName.name?.message}
                            {...registerName('name')}
                        />
                    </div>
                    <Button
                        type="submit"
                        variant="primary"
                        size="md"
                        fullWidth
                        isLoading={isNameLoading}
                        leftIcon={
                            !isNameLoading ? (
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                            ) : undefined
                        }>
                        {isNameLoading ? '업데이트 중...' : '이름 업데이트'}
                    </Button>
                </Card>
            </form>

            {/* 이메일 */}
            <Card
                title="이메일"
                icon={
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                        <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                    </svg>
                }
                className="mb-6">
                <p className="text-gray-700 bg-white px-4 py-3 rounded-md border border-gray-200">{accountData?.email}</p>
            </Card>

            {/* 비밀번호 변경 */}
            <form onSubmit={handlePasswordSubmit(onSubmitPassword)}>
                <Card
                    title="비밀번호 변경"
                    icon={
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                        </svg>
                    }
                    className="mb-6">
                    <div className="bg-yellow-50 border border-gray-300 text-gray-900 px-4 py-3 rounded-md text-sm mb-4 flex items-center">
                        <svg className="w-4 h-4 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        비밀번호는 8자 이상, 소문자, 대문자, 숫자, 특수문자를 포함해야 합니다.
                    </div>
                    <div className="mb-4">
                        <Input
                            label="새 비밀번호"
                            type="password"
                            placeholder="새 비밀번호"
                            maxLength={200}
                            error={errorsPassword.newPassword?.message}
                            {...registerPassword('newPassword')}
                        />
                    </div>
                    <div className="mb-6">
                        <Input
                            label="비밀번호 확인"
                            type="password"
                            placeholder="비밀번호 확인"
                            maxLength={200}
                            error={errorsPassword.confirmPassword?.message}
                            {...registerPassword('confirmPassword')}
                        />
                    </div>
                    <Button
                        type="submit"
                        variant="primary"
                        size="md"
                        fullWidth
                        isLoading={isPasswordLoading}
                        leftIcon={
                            !isPasswordLoading ? (
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                            ) : undefined
                        }>
                        {isPasswordLoading ? '변경 중...' : '비밀번호 변경'}
                    </Button>
                </Card>
            </form>

            {/* 2FA 및 계정 삭제 */}
            <Card
                title="보안 설정"
                icon={
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                }>
                <div className="space-y-3">
                    <div className="flex items-center justify-between p-4 bg-white rounded-lg border border-gray-200">
                        <div>
                            <p className="font-medium text-gray-900">2차 인증</p>
                            <p className="text-sm text-gray-500">계정 보안을 강화합니다</p>
                        </div>
                        <Button
                            variant="primary"
                            size="sm"
                            onClick={() => handle2FA(!accountData?.has2fa)}>
                            {accountData?.has2fa ? '중지' : '활성화'}
                        </Button>
                    </div>
                    <div className="flex items-center justify-between p-4 bg-white rounded-lg border border-gray-200">
                        <div>
                            <p className="font-medium text-gray-900">계정 삭제</p>
                            <p className="text-sm text-gray-500">모든 데이터가 영구적으로 삭제됩니다</p>
                        </div>
                        <Button
                            variant="primary"
                            size="sm"
                            onClick={() => notification('계정 삭제 기능을 구현 중입니다.', { type: 'info' })}>
                            삭제
                        </Button>
                    </div>
                </div>
            </Card>
        </div>
    );
};

export default AccountSettings;
