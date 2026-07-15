import { useState, useEffect } from 'react';
import type { ChangeEvent } from 'react';
import { toast } from '~/utils/toast';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useSuspenseQuery } from '@tanstack/react-query';
import {
    ImagePlus,
    Link,
    Save,
    Trash2,
    UserRound
} from '@blex/ui/icons';
import { useConfirm } from '~/hooks/useConfirm';
import { getStaticPath } from '~/modules/static.module';
import { SettingsHeader } from '../../components';
import { Button, Input, Card, ImageCropDialog } from '~/components/shared';
import {
    deleteCover,
    getProfileSettings,
    updateProfileSettings,
    uploadAvatar,
    uploadCover
} from '~/lib/api/settings';

// Define Zod schema for profile form
const profileSchema = z.object({
    bio: z.string().max(500, '소개는 500자 이내여야 합니다.').optional(),
    homepage: z.string().url('유효한 URL을 입력해주세요.').optional().or(z.literal(''))
});

type ProfileFormInputs = z.infer<typeof profileSchema>;
type ImageCropTarget = 'avatar' | 'cover';

interface ImageCropState {
    target: ImageCropTarget;
    file: File;
}

const IMAGE_CROP_CONFIG = {
    avatar: {
        title: '프로필 이미지 자르기',
        aspectRatio: 1,
        outputWidth: 400,
        outputHeight: 400
    },
    cover: {
        title: '커버 이미지 자르기',
        aspectRatio: 3,
        outputWidth: 1500,
        outputHeight: 500
    }
} as const;

const getDefaultAvatarPath = () => getStaticPath('assets/images/default-avatar.jpg');

const ProfileSetting = () => {
    const [avatar, setAvatar] = useState(getDefaultAvatarPath);
    const [cover, setCover] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [imageCropState, setImageCropState] = useState<ImageCropState | null>(null);
    const { confirm } = useConfirm();

    const {
        register,
        handleSubmit,
        reset,
        formState: { errors, isDirty, isValid }
    } = useForm<ProfileFormInputs>({
        resolver: zodResolver(profileSchema),
        mode: 'onChange'
    });

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
            setAvatar(profileData.avatar || getDefaultAvatarPath());
            setCover(profileData.cover || null);
            reset(
                {
                    bio: profileData.bio || '',
                    homepage: profileData.homepage || ''
                },
                { keepDirtyValues: true }
            );
        }
    }, [profileData, reset]);

    const onSubmit = async (formData: ProfileFormInputs) => {
        setIsLoading(true);

        try {
            const savedProfile = {
                bio: formData.bio || '',
                homepage: formData.homepage || ''
            };
            const { data } = await updateProfileSettings(savedProfile);

            if (data.status === 'DONE') {
                reset(savedProfile);
                toast.success('프로필이 업데이트 되었습니다.');
                void refetch();
            } else {
                toast.error('프로필 업데이트에 실패했습니다.');
            }
        } catch {
            toast.error('프로필 업데이트에 실패했습니다.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleAvatarChange = (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setImageCropState({
            target: 'avatar',
            file
        });
        event.target.value = '';
    };

    const handleCoverChange = (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setImageCropState({
            target: 'cover',
            file
        });
        event.target.value = '';
    };

    const handleImageCropComplete = async (croppedFile: File) => {
        const target = imageCropState?.target;
        if (!target) {
            throw new Error('Image crop target is not set.');
        }

        const isAvatarTarget = target === 'avatar';
        const successMessage = isAvatarTarget
            ? '프로필 이미지가 저장되었습니다.'
            : '커버 이미지가 저장되었습니다.';
        const errorMessage = isAvatarTarget
            ? '프로필 이미지 업데이트에 실패했습니다.'
            : '커버 이미지 업데이트에 실패했습니다.';

        try {
            if (isAvatarTarget) {
                const { data } = await uploadAvatar(croppedFile);
                if (data.status === 'DONE') {
                    setAvatar(data.body.url);
                    toast.success(successMessage);
                    refetch();
                    return;
                }
            } else {
                const { data } = await uploadCover(croppedFile);
                if (data.status === 'DONE') {
                    setCover(data.body.url);
                    toast.success(successMessage);
                    refetch();
                    return;
                }
            }

            toast.error(errorMessage);
            throw new Error(errorMessage);
        } catch (error) {
            if (!(error instanceof Error && error.message === errorMessage)) {
                toast.error(errorMessage);
            }
            throw error;
        }
    };

    const handleCoverDelete = async () => {
        if (!cover) return;

        const confirmed = await confirm({
            title: '커버 이미지 삭제',
            message: '현재 커버 이미지를 삭제하시겠습니까?',
            confirmText: '삭제',
            variant: 'danger'
        });

        if (!confirmed) return;

        try {
            const { data } = await deleteCover();

            if (data.status === 'DONE') {
                setCover(null);
                toast.success('커버 이미지가 삭제되었습니다.');
                refetch();
            } else {
                toast.error('커버 이미지 삭제에 실패했습니다.');
            }
        } catch {
            toast.error('커버 이미지 삭제에 실패했습니다.');
        }
    };

    const imageCropConfig = imageCropState
        ? IMAGE_CROP_CONFIG[imageCropState.target]
        : null;

    return (
        <div>
            <SettingsHeader title="프로필" />

            <div>
                {/* Profile Image Section */}
                <Card
                    title="프로필 이미지"
                    subtitle="자르기 완료 즉시 저장됩니다."
                    className="mb-6">
                    <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
                        <div className="relative w-24 h-24 sm:w-28 sm:h-28">
                            <img
                                src={avatar}
                                alt="프로필 이미지"
                                className="w-full h-full rounded-full object-cover border-4 border-line-light shadow-lg"
                            />
                            <div className="absolute -bottom-1 -right-1">
                                <label
                                    htmlFor="avatar-input"
                                    className="group flex h-11 w-11 cursor-pointer items-center justify-center rounded-full">
                                    <span className="sr-only">프로필 이미지 변경</span>
                                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-action text-content-inverted shadow-md transition-colors group-hover:bg-action-hover group-focus-within:ring-2 group-focus-within:ring-line-strong group-focus-within:ring-offset-2 group-focus-within:ring-offset-surface sm:h-10 sm:w-10">
                                        <ImagePlus aria-hidden="true" className="h-4 w-4 sm:h-5 sm:w-5" />
                                    </span>
                                    <input
                                        id="avatar-input"
                                        type="file"
                                        accept="image/*"
                                        onChange={handleAvatarChange}
                                        className="sr-only"
                                    />
                                </label>
                            </div>
                        </div>
                        <div className="text-center sm:text-left">
                            <p className="text-sm text-content-secondary mb-2">카메라 버튼에서 이미지를 선택할 수 있습니다.</p>
                            <p className="text-xs text-content-hint">권장 크기: 400x400px, 최대 5MB</p>
                        </div>
                    </div>
                </Card>

                {/* Cover Image Section */}
                <Card
                    title="커버 이미지"
                    subtitle="프로필 상단에 표시되며 자르기 완료 즉시 저장됩니다."
                    className="mb-6">
                    <div className="space-y-4">
                        {cover ? (
                            <div className="relative group">
                                <div className="aspect-[3/1] w-full rounded-2xl overflow-hidden ring-1 ring-line/5">
                                    <img
                                        src={cover}
                                        alt="커버 이미지"
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                                <div className="absolute inset-0 bg-action bg-opacity-0 group-hover:bg-opacity-40 group-focus-within:bg-opacity-40 transition-all duration-200 rounded-2xl flex items-center justify-center opacity-0 group-hover:opacity-100 group-focus-within:opacity-100">
                                    <label
                                        htmlFor="cover-input"
                                        className="px-6 py-3 bg-surface hover:bg-surface-subtle rounded-xl text-sm font-semibold text-content cursor-pointer transition-colors shadow-lg focus-within:ring-2 focus-within:ring-line-strong">
                                        이미지 변경
                                        <input
                                            id="cover-input"
                                            type="file"
                                            accept="image/*"
                                            onChange={handleCoverChange}
                                            className="sr-only"
                                        />
                                    </label>
                                </div>
                            </div>
                        ) : (
                            <label htmlFor="cover-input-empty" className="block rounded-2xl focus-within:ring-2 focus-within:ring-line-strong">
                                <div className="aspect-[3/1] w-full rounded-2xl border-2 border-dashed border-line hover:border-line hover:bg-surface-subtle transition-all duration-200 cursor-pointer flex flex-col items-center justify-center gap-3 group">
                                    <ImagePlus
                                        aria-hidden="true"
                                        className="h-12 w-12 text-content-hint transition-colors group-hover:text-content-hint"
                                    />
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
                                    className="sr-only"
                                />
                            </label>
                        )}
                        {cover && (
                            <div className="flex justify-end">
                                <button
                                    type="button"
                                    onClick={handleCoverDelete}
                                    className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-danger-line px-4 py-2 text-sm font-semibold text-danger transition-colors hover:bg-danger-surface [@media(pointer:fine)]:min-h-9">
                                    <Trash2 aria-hidden="true" className="h-4 w-4" />
                                    커버 이미지 삭제
                                </button>
                            </div>
                        )}
                        <div>
                            <p className="text-xs text-content-hint">권장 크기: 1500x500px (3:1 비율), 최대 5MB</p>
                        </div>
                    </div>
                </Card>
            </div>

            <form onSubmit={handleSubmit(onSubmit)}>
                {/* Profile Information Section */}
                <Card
                    title="기본 정보"
                    subtitle="소개와 홈페이지는 저장 버튼을 눌러 반영합니다."
                    className="mb-6">
                    <div className="mb-6">
                        <Input
                            density="compact"
                            label="소개"
                            leftIcon={<UserRound aria-hidden="true" className="h-4 w-4" />}
                            multiline
                            rows={4}
                            placeholder="자신을 간단히 소개해 보세요. 관심사, 전문 분야, 취미 등을 알려주세요."
                            error={errors.bio?.message}
                            {...register('bio')}
                        />
                    </div>

                    <Input
                        density="compact"
                        label="홈페이지"
                        leftIcon={<Link aria-hidden="true" className="h-4 w-4" />}
                        type="url"
                        placeholder="https://example.com"
                        error={errors.homepage?.message}
                        {...register('homepage')}
                    />
                </Card>

                <div className="flex justify-end">
                    <Button
                        density="compact"
                        type="submit"
                        variant="primary"
                        size="md"
                        className="min-h-11! [@media(pointer:fine)]:min-h-10!"
                        disabled={!isDirty || !isValid || isLoading}
                        isLoading={isLoading}
                        leftIcon={
                            !isLoading ? <Save aria-hidden="true" className="h-4 w-4" /> : undefined
                        }>
                        {isLoading ? '저장 중...' : '기본 정보 저장'}
                    </Button>
                </div>
            </form>

            {imageCropConfig && (
                <ImageCropDialog
                    isOpen={Boolean(imageCropState)}
                    file={imageCropState?.file ?? null}
                    title={imageCropConfig.title}
                    aspectRatio={imageCropConfig.aspectRatio}
                    outputWidth={imageCropConfig.outputWidth}
                    outputHeight={imageCropConfig.outputHeight}
                    onClose={() => setImageCropState(null)}
                    onComplete={handleImageCropComplete}
                />
            )}
        </div>
    );
};

export default ProfileSetting;
