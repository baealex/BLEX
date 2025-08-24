import React, { useState, useEffect } from 'react';
import { http } from '~/modules/http.module';
import { notification } from '@baejino/ui';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

// Define Zod schema for profile form
const profileSchema = z.object({
    bio: z.string().max(500, '소개는 500자 이내여야 합니다.').optional(),
    homepage: z.string().url('유효한 URL을 입력해주세요.').optional().or(z.literal(''))
});

type ProfileFormInputs = z.infer<typeof profileSchema>;

const ProfileSetting = () => {
    const [avatar, setAvatar] = useState('/static/assets/images/default-avatar.jpg'); // Default avatar
    const [isLoading, setIsLoading] = useState(false);

    const { register, handleSubmit, reset, formState: { errors } } = useForm<ProfileFormInputs>({ resolver: zodResolver(profileSchema) });

    // Fetch initial data
    useEffect(() => {
        const fetchProfileData = async () => {
            try {
                const { data } = await http('v1/setting/profile', { method: 'GET' });
                if (data.status === 'DONE') {
                    setAvatar(data.body.avatar || '/static/assets/images/default-avatar.jpg');
                    reset({
                        bio: data.body.bio || '',
                        homepage: data.body.homepage || ''
                    });
                } else {
                    notification('프로필 정보를 불러오는데 실패했습니다.', { type: 'error' });
                }
            } catch (error) {
                notification('프로필 정보를 불러오는데 실패했습니다.', { type: 'error' });
            }
        };
        fetchProfileData();
    }, [reset]);

    const onSubmit = async (formData: ProfileFormInputs) => {
        setIsLoading(true);

        try {
            const { data } = await http('v1/setting/profile', {
                method: 'PUT',
                data: formData
            });

            if (data.status === 'DONE') {
                notification('프로필이 업데이트 되었습니다.', { type: 'success' });
            } else {
                notification('프로필 업데이트에 실패했습니다.', { type: 'error' });
            }
        } catch (error) {
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
            } else {
                notification('프로필 이미지 업데이트에 실패했습니다.', { type: 'error' });
            }
        } catch (error) {
            notification('프로필 이미지 업데이트에 실패했습니다.', { type: 'error' });
        }
    };

    return (
        <div className="p-6 bg-white shadow-md rounded-lg">
            <form onSubmit={handleSubmit(onSubmit)}>
                <div className="mb-6 flex items-center">
                    <div className="relative w-24 h-24 mr-4">
                        <img
                            src={avatar}
                            alt="프로필 이미지"
                            className="w-full h-full rounded-full object-cover border-2 border-gray-200"
                        />
                        <div className="absolute bottom-0 right-0 bg-primary-500 w-8 h-8 rounded-full flex items-center justify-center cursor-pointer shadow-md">
                            <label htmlFor="avatar-input" className="text-white cursor-pointer w-full h-full flex items-center justify-center">
                                <i className="fas fa-camera text-sm" />
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
                    <div>
                        <label className="block text-lg font-semibold text-gray-800">프로필 이미지</label>
                        <p className="text-sm text-gray-500">클릭하여 이미지를 변경하세요.</p>
                    </div>
                </div>

                <div className="mb-4">
                    <label htmlFor="bio" className="block text-sm font-medium text-gray-700 mb-1">소개</label>
                    <textarea
                        id="bio"
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm p-2"
                        {...register('bio')}
                        rows={4}
                        placeholder="자신을 소개해 보세요"
                    />
                    {errors.bio && <p className="text-red-500 text-xs mt-1">{errors.bio.message}</p>}
                </div>

                <div className="mb-6">
                    <label htmlFor="homepage" className="block text-sm font-medium text-gray-700 mb-1">홈페이지</label>
                    <input
                        id="homepage"
                        type="url"
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm p-2"
                        {...register('homepage')}
                        placeholder="https://"
                    />
                    {errors.homepage && <p className="text-red-500 text-xs mt-1">{errors.homepage.message}</p>}
                </div>

                <button
                    type="submit"
                    className="w-full inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={isLoading}>{isLoading ? '저장 중...' : '저장'}</button>
            </form>
        </div>
    );
};

export default ProfileSetting;
