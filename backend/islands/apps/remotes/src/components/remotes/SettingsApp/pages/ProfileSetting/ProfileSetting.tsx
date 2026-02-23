import { useState, useEffect } from 'react';
import { toast } from '~/utils/toast';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useSuspenseQuery } from '@tanstack/react-query';
import { useConfirm } from '~/hooks/useConfirm';
import { SettingsHeader } from '../../components';
import { Button, Input, Card } from '~/components/shared';
import { getProfileSettings, updateProfileSettings, uploadAvatar, uploadCover } from '~/lib/api/settings';

// Define Zod schema for profile form
const profileSchema = z.object({
    bio: z.string().max(500, '소개는 500자 이내여야 합니다.').optional(),
    homepage: z.string().url('유효한 URL을 입력해주세요.').optional().or(z.literal(''))
});

type ProfileFormInputs = z.infer<typeof profileSchema>;

const ProfileSetting = () => {
    const [avatar, setAvatar] = useState('/resources/staticfiles/images/default-avatar.jpg');
    const [cover, setCover] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const { confirm } = useConfirm();

    const { register, handleSubmit, reset, formState: { errors } } = useForm<ProfileFormInputs>({ resolver: zodResolver(profileSchema) });

    const { data: profileData, refetch } = useSuspenseQuery({
        queryKey: ['profile-setting'],
        queryFn: async () => {
            const { data } = await getProfileSettings();
            if (data.status === 'DONE') {
                return data.body;
            }
            throw new Error('프로필 정보를 불러오는데 실패했습니다.');
        }
    });

    useEffect(() => {
        if (profileData) {
            setAvatar(profileData.avatar || '/resources/staticfiles/images/default-avatar.jpg');
            setCover(profileData.cover || null);
            reset({
                bio: profileData.bio || '',
                homepage: profileData.homepage || ''
            });
        }
    }, [profileData, reset]);

    const onSubmit = async (formData: ProfileFormInputs) => {
        setIsLoading(true);

        try {
            const { data } = await updateProfileSettings({
                bio: formData.bio || '',
                homepage: formData.homepage || ''
            });

            if (data.status === 'DONE') {
                toast.success('프로필이 업데이트 되었습니다.');
                refetch();
            } else {
                toast.error('프로필 업데이트에 실패했습니다.');
            }
        } catch {
            toast.error('프로필 업데이트에 실패했습니다.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const confirmed = await confirm({
            title: '프로필 이미지 변경',
            message: '프로필 이미지를 변경하시겠습니까?',
            confirmText: '변경'
        });

        if (!confirmed) {
            e.target.value = '';
            return;
        }

        try {
            const { data } = await uploadAvatar(file);

            if (data.status === 'DONE') {
                setAvatar(data.body.url);
                toast.success('프로필 이미지가 업데이트 되었습니다.');
                refetch();
            } else {
                toast.error('프로필 이미지 업데이트에 실패했습니다.');
            }
        } catch {
            toast.error('프로필 이미지 업데이트에 실패했습니다.');
        } finally {
            e.target.value = '';
        }
    };

    const handleCoverChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const confirmed = await confirm({
            title: '커버 이미지 변경',
            message: '커버 이미지를 변경하시겠습니까?',
            confirmText: '변경'
        });

        if (!confirmed) {
            e.target.value = '';
            return;
        }

        try {
            const { data } = await uploadCover(file);

            if (data.status === 'DONE') {
                setCover(data.body.url);
                toast.success('커버 이미지가 업데이트 되었습니다.');
                refetch();
            } else {
                toast.error('커버 이미지 업데이트에 실패했습니다.');
            }
        } catch {
            toast.error('커버 이미지 업데이트에 실패했습니다.');
        } finally {
            e.target.value = '';
        }
    };

    return (
        <div>
            <SettingsHeader
                title="프로필"
                description="다른 사용자들에게 보여질 프로필 정보를 관리하세요."
            />

            <form onSubmit={handleSubmit(onSubmit)}>
                {/* Profile Image Section */}
                <Card title="프로필 이미지" className="mb-6">
                    <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
                        <div className="relative w-24 h-24 sm:w-28 sm:h-28">
                            <img
                                src={avatar}
                                alt="프로필 이미지"
                                className="w-full h-full rounded-full object-cover border-4 border-line-light shadow-lg"
                            />
                            <div className="absolute bottom-0 right-0 bg-action w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center cursor-pointer shadow-md hover:bg-action transition-colors">
                                <label htmlFor="avatar-input" className="text-content-inverted cursor-pointer w-full h-full flex items-center justify-center">
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
                            <h4 className="text-base sm:text-lg font-semibold text-content mb-1">이미지 변경</h4>
                            <p className="text-sm text-content-secondary mb-2">카메라 아이콘을 클릭하여 새로운 프로필 이미지를 업로드하세요.</p>
                            <p className="text-xs text-content-hint">권장 크기: 400x400px, 최대 5MB</p>
                        </div>
                    </div>
                </Card>

                {/* Cover Image Section */}
                <Card title="커버 이미지" className="mb-6">
                    <div className="space-y-4">
                        {cover ? (
                            <div className="relative group">
                                <div className="aspect-[21/9] w-full rounded-2xl overflow-hidden ring-1 ring-line/5">
                                    <img
                                        src={cover}
                                        alt="커버 이미지"
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                                <div className="absolute inset-0 bg-action bg-opacity-0 group-hover:bg-opacity-40 transition-all duration-200 rounded-2xl flex items-center justify-center opacity-0 group-hover:opacity-100">
                                    <label
                                        htmlFor="cover-input"
                                        className="px-6 py-3 bg-surface hover:bg-surface-subtle rounded-xl text-sm font-semibold text-content cursor-pointer transition-colors shadow-lg">
                                        이미지 변경
                                    </label>
                                </div>
                                <input
                                    id="cover-input"
                                    type="file"
                                    accept="image/*"
                                    onChange={handleCoverChange}
                                    className="hidden"
                                />
                            </div>
                        ) : (
                            <label htmlFor="cover-input-empty" className="block">
                                <div className="aspect-[21/9] w-full rounded-2xl border-2 border-dashed border-line hover:border-line hover:bg-surface-subtle transition-all duration-200 cursor-pointer flex flex-col items-center justify-center gap-3 group">
                                    <svg className="w-12 h-12 text-content-hint group-hover:text-content-hint transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                    <div className="text-center">
                                        <p className="text-sm font-semibold text-content-secondary mb-1">커버 이미지 추가</p>
                                        <p className="text-xs text-content-hint">클릭하여 이미지를 업로드하세요</p>
                                    </div>
                                </div>
                                <input
                                    id="cover-input-empty"
                                    type="file"
                                    accept="image/*"
                                    onChange={handleCoverChange}
                                    className="hidden"
                                />
                            </label>
                        )}
                        <div>
                            <p className="text-sm text-content-secondary mb-1">프로필 페이지 상단에 표시되는 배너 이미지입니다.</p>
                            <p className="text-xs text-content-hint">권장 크기: 1200x514px (21:9 비율), 최대 5MB</p>
                        </div>
                    </div>
                </Card>

                {/* Profile Information Section */}
                <Card title="기본 정보" className="mb-6">
                    <div className="mb-6">
                        <Input
                            label="소개"
                            leftIcon={
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-6-3a2 2 0 11-4 0 2 2 0 014 0zm-2 4a5 5 0 00-4.546 2.916A5.986 5.986 0 0010 16a5.986 5.986 0 004.546-2.084A5 5 0 0010 11z" clipRule="evenodd" />
                                </svg>
                            }
                            multiline
                            rows={4}
                            placeholder="자신을 간단히 소개해 보세요. 관심사, 전문 분야, 취미 등을 알려주세요."
                            error={errors.bio?.message}
                            {...register('bio')}
                        />
                    </div>

                    <Input
                        label="홈페이지"
                        leftIcon={
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M12.586 4.586a2 2 0 112.828 2.828l-3 3a2 2 0 01-2.828 0 1 1 0 00-1.414 1.414 4 4 0 005.656 0l3-3a4 4 0 00-5.656-5.656l-1.5 1.5a1 1 0 101.414 1.414l1.5-1.5zm-5 5a2 2 0 012.828 0 1 1 0 101.414-1.414 4 4 0 00-5.656 0l-3 3a4 4 0 105.656 5.656l1.5-1.5a1 1 0 10-1.414-1.414l-1.5 1.5a2 2 0 11-2.828-2.828l3-3z" clipRule="evenodd" />
                            </svg>
                        }
                        type="url"
                        placeholder="https://example.com"
                        error={errors.homepage?.message}
                        {...register('homepage')}
                    />
                </Card>

                <Button
                    type="submit"
                    variant="primary"
                    size="md"
                    fullWidth
                    isLoading={isLoading}
                    leftIcon={
                        !isLoading ? (
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                        ) : undefined
                    }>
                    {isLoading ? '저장 중...' : '프로필 저장'}
                </Button>
            </form>
        </div>
    );
};

export default ProfileSetting;
