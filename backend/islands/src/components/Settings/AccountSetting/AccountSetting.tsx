import React, { useState } from 'react';
import { http, type Response } from '~/modules/http.module';
import { notification } from '@baejino/ui';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useFetch } from '~/hooks/use-fetch';

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

    const { data: accountData, isLoading: isDataLoading, isError, refetch } = useFetch({
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

    if (isDataLoading) {
        return (
            <div className="p-6 bg-white shadow-sm rounded-lg">
                <div className="animate-pulse">
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 mb-6">
                        <div className="h-6 bg-gray-200 rounded w-32 mb-2" />
                        <div className="h-4 bg-gray-200 rounded w-64" />
                    </div>
                    <div className="space-y-6">
                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
                            <div className="h-6 bg-gray-200 rounded w-24 mb-4" />
                            <div className="h-10 bg-gray-200 rounded" />
                        </div>
                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
                            <div className="h-6 bg-gray-200 rounded w-24 mb-4" />
                            <div className="h-10 bg-gray-200 rounded" />
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 sm:p-6 bg-white shadow-sm rounded-lg">
            {/* Header Section */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 sm:p-6 mb-4 sm:mb-6">
                <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-2">계정 설정</h2>
                <p className="text-gray-700">아이디, 이름, 비밀번호 등 계정 정보를 관리하세요.</p>
            </div>

            {/* 가입일 */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 sm:p-6 mb-4 sm:mb-6">
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <svg className="w-5 h-5 mr-2 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                    </svg>
                    가입일
                </h3>
                <p className="text-gray-700 bg-white px-4 py-3 rounded-md border border-gray-200">{accountData?.createdDate}</p>
            </div>

            {/* 사용자 필명 */}
            <form onSubmit={handleUsernameSubmit(onSubmitUsername)}>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 sm:p-6 mb-4 sm:mb-6">
                    <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-4 flex items-center">
                        <svg className="w-5 h-5 mr-2 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-6-3a2 2 0 11-4 0 2 2 0 014 0zm-2 4a5 5 0 00-4.546 2.916A5.986 5.986 0 0010 16a5.986 5.986 0 004.546-2.084A5 5 0 0010 11z" clipRule="evenodd" />
                        </svg>
                        사용자 필명
                    </h3>
                    <div className="bg-yellow-50 border border-gray-300 text-gray-900 px-4 py-3 rounded-md text-sm mb-4 flex items-center">
                        <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        사용자의 필명은 로그인시 사용되며 주소(URL)에 표기되는 이름입니다. 작성한 포스트가 존재하는 경우 6개월에 한번만 변경할 수 있습니다.
                    </div>
                    <input
                        type="text"
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-gray-500 focus:ring-gray-500 text-sm p-3 mb-3 transition-colors"
                        placeholder="사용자 필명"
                        maxLength={30}
                        {...registerUsername('username')}
                    />
                    {errorsUsername.username && <p className="text-gray-500 text-xs mb-3 flex items-center">
                        <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        {errorsUsername.username.message}
                    </p>}
                    <button
                        type="submit"
                        className="w-full inline-flex justify-center items-center py-3 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-black hover:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors touch-manipulation min-h-[48px]"
                        disabled={isUsernameLoading}>
                        {isUsernameLoading ? (
                            <>
                                <svg
                                    className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                                    xmlns="http://www.w3.org/2000/svg"
                                    fill="none"
                                    viewBox="0 0 24 24">
                                    <circle
                                        className="opacity-25"
                                        cx="12"
                                        cy="12"
                                        r="10"
                                        stroke="currentColor"
                                        strokeWidth="4"
                                    />
                                    <path
                                        className="opacity-75"
                                        fill="currentColor"
                                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                    />
                                </svg>
                                업데이트 중...
                            </>
                        ) : (
                            <>
                                <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                                필명 업데이트
                            </>
                        )}
                    </button>
                </div>
            </form>

            {/* 사용자 이름 */}
            <form onSubmit={handleNameSubmit(onSubmitName)}>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 sm:p-6 mb-4 sm:mb-6">
                    <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-4 flex items-center">
                        <svg className="w-5 h-5 mr-2 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                        </svg>
                        사용자 이름
                    </h3>
                    <input
                        type="text"
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-gray-500 focus:ring-gray-500 text-sm p-3 mb-3 transition-colors"
                        placeholder="사용자 실명"
                        maxLength={30}
                        {...registerName('name')}
                    />
                    {errorsName.name && <p className="text-gray-500 text-xs mb-3 flex items-center">
                        <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        {errorsName.name.message}
                    </p>}
                    <button
                        type="submit"
                        className="w-full inline-flex justify-center items-center py-3 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-black hover:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        disabled={isNameLoading}>
                        {isNameLoading ? (
                            <>
                                <svg
                                    className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                                    xmlns="http://www.w3.org/2000/svg"
                                    fill="none"
                                    viewBox="0 0 24 24">
                                    <circle
                                        className="opacity-25"
                                        cx="12"
                                        cy="12"
                                        r="10"
                                        stroke="currentColor"
                                        strokeWidth="4"
                                    />
                                    <path
                                        className="opacity-75"
                                        fill="currentColor"
                                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                    />
                                </svg>
                                업데이트 중...
                            </>
                        ) : (
                            <>
                                <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                                이름 업데이트
                            </>
                        )}
                    </button>
                </div>
            </form>

            {/* 이메일 */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 sm:p-6 mb-4 sm:mb-6">
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <svg className="w-5 h-5 mr-2 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                        <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                    </svg>
                    이메일
                </h3>
                <p className="text-gray-700 bg-white px-4 py-3 rounded-md border border-gray-200">{accountData?.email}</p>
            </div>

            {/* 비밀번호 변경 */}
            <form onSubmit={handlePasswordSubmit(onSubmitPassword)}>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 mb-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                        <svg className="w-5 h-5 mr-2 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                        </svg>
                        비밀번호 변경
                    </h3>
                    <div className="bg-yellow-50 border border-gray-300 text-gray-900 px-4 py-3 rounded-md text-sm mb-4 flex items-center">
                        <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        비밀번호는 8자 이상, 소문자, 대문자, 숫자, 특수문자를 포함해야 합니다.
                    </div>
                    <div className="mb-4">
                        <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-2">새 비밀번호</label>
                        <input
                            id="newPassword"
                            type="password"
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-gray-500 focus:ring-gray-500 sm:text-sm p-3 transition-colors"
                            placeholder="새 비밀번호"
                            maxLength={200}
                            {...registerPassword('newPassword')}
                        />
                        {errorsPassword.newPassword && <p className="text-gray-500 text-xs mt-1 flex items-center">
                            <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                            {errorsPassword.newPassword.message}
                        </p>}
                    </div>
                    <div className="mb-6">
                        <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">비밀번호 확인</label>
                        <input
                            id="confirmPassword"
                            type="password"
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-gray-500 focus:ring-gray-500 sm:text-sm p-3 transition-colors"
                            placeholder="비밀번호 확인"
                            maxLength={200}
                            {...registerPassword('confirmPassword')}
                        />
                        {errorsPassword.confirmPassword && <p className="text-gray-500 text-xs mt-1 flex items-center">
                            <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                            {errorsPassword.confirmPassword.message}
                        </p>}
                    </div>
                    <button
                        type="submit"
                        className="w-full inline-flex justify-center items-center py-3 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-black hover:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        disabled={isPasswordLoading}>
                        {isPasswordLoading ? (
                            <>
                                <svg
                                    className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                                    xmlns="http://www.w3.org/2000/svg"
                                    fill="none"
                                    viewBox="0 0 24 24">
                                    <circle
                                        className="opacity-25"
                                        cx="12"
                                        cy="12"
                                        r="10"
                                        stroke="currentColor"
                                        strokeWidth="4"
                                    />
                                    <path
                                        className="opacity-75"
                                        fill="currentColor"
                                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                    />
                                </svg>
                                변경 중...
                            </>
                        ) : (
                            <>
                                <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                                비밀번호 변경
                            </>
                        )}
                    </button>
                </div>
            </form>

            {/* 2FA 및 계정 삭제 */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <svg className="w-5 h-5 mr-2 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    보안 설정
                </h3>
                <div className="space-y-3">
                    <div className="flex items-center justify-between p-4 bg-white rounded-lg border border-gray-200">
                        <div className="flex items-center">
                            <div>
                                <p className="font-medium text-gray-900">2차 인증</p>
                                <p className="text-sm text-gray-500">계정 보안을 강화합니다</p>
                            </div>
                        </div>
                        {accountData?.has2fa ? (
                            <button
                                type="button"
                                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-black hover:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors"
                                onClick={() => handle2FA(false)}>
                                중지
                            </button>
                        ) : (
                            <button
                                type="button"
                                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-black hover:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors"
                                onClick={() => handle2FA(true)}>
                                활성화
                            </button>
                        )}
                    </div>
                    <div className="flex items-center justify-between p-4 bg-white rounded-lg border border-gray-200">
                        <div className="flex items-center">
                            <div>
                                <p className="font-medium text-gray-900">계정 삭제</p>
                                <p className="text-sm text-gray-500">모든 데이터가 영구적으로 삭제됩니다</p>
                            </div>
                        </div>
                        <button
                            type="button"
                            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-black hover:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors"
                            onClick={() => notification('계정 삭제 기능을 구현 중입니다.', { type: 'info' })}>
                            삭제
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AccountSettings;
