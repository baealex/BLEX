import { useState, useEffect } from 'react';
import { http } from '~/modules/http.module';
import { notification } from '@baejino/ui';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useFetch } from '~/hooks/use-fetch';

// Define Zod schema for profile form
const profileSchema = z.object({
    bio: z.string().max(500, '소개는 500자 이내여야 합니다.').optional(),
    homepage: z.string().url('유효한 URL을 입력해주세요.').optional().or(z.literal(''))
});

type ProfileFormInputs = z.infer<typeof profileSchema>;

const ProfileSetting = () => {
    const [avatar, setAvatar] = useState('/resources/staticfiles/images/default-avatar.jpg');
    const [isLoading, setIsLoading] = useState(false);

    const { register, handleSubmit, reset, formState: { errors } } = useForm<ProfileFormInputs>({ resolver: zodResolver(profileSchema) });

    const { data: profileData, isLoading: isDataLoading, isError, refetch } = useFetch({
        queryKey: ['profile-setting'],
        queryFn: async () => {
            const { data } = await http('v1/setting/profile', { method: 'GET' });
            if (data.status === 'DONE') {
                return data.body;
            }
            throw new Error('프로필 정보를 불러오는데 실패했습니다.');
        }
    });

    useEffect(() => {
        if (profileData) {
            setAvatar(profileData.avatar || '/resources/staticfiles/images/default-avatar.jpg');
            reset({
                bio: profileData.bio || '',
                homepage: profileData.homepage || ''
            });
        }
    }, [profileData, reset]);

    useEffect(() => {
        if (isError) {
            notification('프로필 정보를 불러오는데 실패했습니다.', { type: 'error' });
        }
    }, [isError]);

    const onSubmit = async (formData: ProfileFormInputs) => {
        setIsLoading(true);

        try {
            const params = new URLSearchParams();
            params.append('bio', formData.bio || '');
            params.append('homepage', formData.homepage || '');

            const { data } = await http('v1/setting/profile', {
                method: 'PUT',
                data: params.toString(),
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
            });

            if (data.status === 'DONE') {
                notification('프로필이 업데이트 되었습니다.', { type: 'success' });
                refetch(); // 데이터 다시 가져오기
            } else {
                notification('프로필 업데이트에 실패했습니다.', { type: 'error' });
            }
        } catch {
            notification('프로필 업데이트에 실패했습니다.', { type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('avatar', file);

        try {
            const { data } = await http('v1/setting/avatar', {
                method: 'POST',
                data: formData
            });

            if (data.status === 'DONE') {
                setAvatar(data.body.url);
                notification('프로필 이미지가 업데이트 되었습니다.', { type: 'success' });
                refetch(); // 데이터 다시 가져오기
            } else {
                notification('프로필 이미지 업데이트에 실패했습니다.', { type: 'error' });
            }
        } catch {
            notification('프로필 이미지 업데이트에 실패했습니다.', { type: 'error' });
        }
    };

    if (isDataLoading) {
        return (
            <div className="p-4 sm:p-6 bg-white shadow-md rounded-lg">
                <div className="animate-pulse">
                    <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 mb-4 sm:mb-6">
                        <div className="w-20 h-20 sm:w-24 sm:h-24 bg-gray-200 rounded-full" />
                        <div className="text-center sm:text-left">
                            <div className="h-5 sm:h-6 bg-gray-200 rounded w-24 sm:w-32 mb-2" />
                            <div className="h-3 sm:h-4 bg-gray-200 rounded w-36 sm:w-48" />
                        </div>
                    </div>
                    <div className="space-y-3 sm:space-y-4">
                        <div className="h-3 sm:h-4 bg-gray-200 rounded w-12 sm:w-16" />
                        <div className="h-20 sm:h-24 bg-gray-200 rounded" />
                        <div className="h-3 sm:h-4 bg-gray-200 rounded w-16 sm:w-20" />
                        <div className="h-10 sm:h-10 bg-gray-200 rounded" />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 sm:p-6 bg-white shadow-sm rounded-lg">
            {/* Header Section */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4 sm:p-6 mb-4 sm:mb-6">
                <h2 className="text-lg sm:text-xl font-bold text-blue-900 mb-2">프로필 설정</h2>
                <p className="text-blue-700">다른 사용자들에게 보여질 프로필 정보를 관리하세요.</p>
            </div>
            <form onSubmit={handleSubmit(onSubmit)}>
                {/* Profile Image Section */}
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 sm:p-6 mb-4 sm:mb-6">
                    <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-4">프로필 이미지</h3>
                    <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
                        <div className="relative w-24 h-24 sm:w-28 sm:h-28">
                            <img
                                src={avatar}
                                alt="프로필 이미지"
                                className="w-full h-full rounded-full object-cover border-4 border-white shadow-lg"
                            />
                            <div className="absolute bottom-0 right-0 bg-blue-600 w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center cursor-pointer shadow-md hover:bg-blue-700 transition-colors">
                                <label htmlFor="avatar-input" className="text-white cursor-pointer w-full h-full flex items-center justify-center">
                                    <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                                    </svg>
                                </label>
                                <input
                                    id="avatar-input"
                                    type="file"
                                    accept="image/*"
                                    onChange={handleAvatarChange}
                                    className="hidden"
                                />
                            </div>
                        </div>
                        <div className="text-center sm:text-left">
                            <h4 className="text-base sm:text-lg font-semibold text-gray-800 mb-1">이미지 변경</h4>
                            <p className="text-sm text-gray-500 mb-2">카메라 아이콘을 클릭하여 새로운 프로필 이미지를 업로드하세요.</p>
                            <p className="text-xs text-gray-400">권장 크기: 400x400px, 최대 5MB</p>
                        </div>
                    </div>
                </div>

                {/* Profile Information Section */}
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 sm:p-6 mb-4 sm:mb-6">
                    <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-4">기본 정보</h3>

                    <div className="mb-4 sm:mb-6">
                        <label htmlFor="bio" className="flex items-center text-sm font-medium text-gray-700 mb-2">
                            <svg className="w-4 h-4 mr-2 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-6-3a2 2 0 11-4 0 2 2 0 014 0zm-2 4a5 5 0 00-4.546 2.916A5.986 5.986 0 0010 16a5.986 5.986 0 004.546-2.084A5 5 0 0010 11z" clipRule="evenodd" />
                            </svg>
                            소개
                        </label>
                        <textarea
                            id="bio"
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm p-3 transition-colors"
                            {...register('bio')}
                            rows={4}
                            placeholder="자신을 간단히 소개해 보세요. 관심사, 전문 분야, 취미 등을 알려주세요."
                        />
                        {errors.bio && <p className="text-red-500 text-xs mt-1 flex items-center">
                            <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                            {errors.bio.message}
                        </p>}
                    </div>

                    <div>
                        <label htmlFor="homepage" className="flex items-center text-sm font-medium text-gray-700 mb-2">
                            <svg className="w-4 h-4 mr-2 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M12.586 4.586a2 2 0 112.828 2.828l-3 3a2 2 0 01-2.828 0 1 1 0 00-1.414 1.414 4 4 0 005.656 0l3-3a4 4 0 00-5.656-5.656l-1.5 1.5a1 1 0 101.414 1.414l1.5-1.5zm-5 5a2 2 0 012.828 0 1 1 0 101.414-1.414 4 4 0 00-5.656 0l-3 3a4 4 0 105.656 5.656l1.5-1.5a1 1 0 10-1.414-1.414l-1.5 1.5a2 2 0 11-2.828-2.828l3-3z" clipRule="evenodd" />
                            </svg>
                            홈페이지
                        </label>
                        <input
                            id="homepage"
                            type="url"
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm p-3 transition-colors"
                            {...register('homepage')}
                            placeholder="https://example.com"
                        />
                        {errors.homepage && <p className="text-red-500 text-xs mt-1 flex items-center">
                            <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                            {errors.homepage.message}
                        </p>}
                    </div>
                </div>

                <button
                    type="submit"
                    className="w-full inline-flex justify-center items-center py-3 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors touch-manipulation min-h-[48px]"
                    disabled={isLoading}>
                    {isLoading ? (
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
                            저장 중...
                        </>
                    ) : (
                        <>
                            <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                            프로필 저장
                        </>
                    )}
                </button>
            </form>
        </div>
    );
};

export default ProfileSetting;
