import { useState, useEffect, useMemo } from 'react';
import type { ChangeEvent } from 'react';
import { Trans, useLingui } from '@lingui/react/macro';
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

interface ProfileFormInputs {
    bio?: string;
    homepage?: string;
}

type ImageCropTarget = 'avatar' | 'cover';

interface ImageCropState {
    target: ImageCropTarget;
    file: File;
}

const IMAGE_CROP_CONFIG = {
    avatar: {
        aspectRatio: 1,
        outputWidth: 400,
        outputHeight: 400
    },
    cover: {
        aspectRatio: 3,
        outputWidth: 1500,
        outputHeight: 500
    }
} as const;

const getDefaultAvatarPath = () => getStaticPath('assets/images/default-avatar.jpg');

const ProfileSetting = () => {
    const { t } = useLingui();
    const profileSchema = useMemo(() => z.object({
        bio: z.string().max(500, t({
            id: 'settings.profile.bio.validation.max_length',
            message: 'Bio must be 500 characters or fewer.'
        })).optional(),
        homepage: z.string().url(t({
            id: 'settings.profile.homepage.validation.url',
            message: 'Enter a valid URL.'
        })).optional().or(z.literal(''))
    }), [t]);
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
            throw new Error(t({
                id: 'settings.profile.load_failed',
                message: 'Could not load profile information.'
            }));
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
                toast.success(t({
                    id: 'settings.profile.update_success',
                    message: 'Profile updated.'
                }));
                void refetch();
            } else {
                toast.error(data.errorMessage || t({
                    id: 'settings.profile.update_failed',
                    message: 'Could not update the profile.'
                }));
            }
        } catch {
            toast.error(t({
                id: 'settings.profile.update_failed',
                message: 'Could not update the profile.'
            }));
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
            ? t({
                id: 'settings.profile.avatar.save_success',
                message: 'Profile picture saved.'
            })
            : t({
                id: 'settings.profile.cover.save_success',
                message: 'Cover image saved.'
            });
        const errorMessage = isAvatarTarget
            ? t({
                id: 'settings.profile.avatar.update_failed',
                message: 'Could not update the profile picture.'
            })
            : t({
                id: 'settings.profile.cover.update_failed',
                message: 'Could not update the cover image.'
            });

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
            title: t({
                id: 'settings.profile.cover.delete_title',
                message: 'Delete cover image'
            }),
            message: t({
                id: 'settings.profile.cover.delete_confirm',
                message: 'Delete the current cover image?'
            }),
            confirmText: t({
                id: 'common.delete',
                message: 'Delete'
            }),
            variant: 'danger'
        });

        if (!confirmed) return;

        try {
            const { data } = await deleteCover();

            if (data.status === 'DONE') {
                setCover(null);
                toast.success(t({
                    id: 'settings.profile.cover.delete_success',
                    message: 'Cover image deleted.'
                }));
                refetch();
            } else {
                toast.error(t({
                    id: 'settings.profile.cover.delete_failed',
                    message: 'Could not delete the cover image.'
                }));
            }
        } catch {
            toast.error(t({
                id: 'settings.profile.cover.delete_failed',
                message: 'Could not delete the cover image.'
            }));
        }
    };

    const imageCropConfig = imageCropState
        ? IMAGE_CROP_CONFIG[imageCropState.target]
        : null;
    const imageCropTitle = imageCropState
        ? imageCropState.target === 'avatar'
            ? t({
                id: 'settings.profile.avatar.crop_title',
                message: 'Crop profile picture'
            })
            : t({
                id: 'settings.profile.cover.crop_title',
                message: 'Crop cover image'
            })
        : '';

    return (
        <div>
            <SettingsHeader
                title={t({
                    id: 'settings.profile.title',
                    message: 'Profile'
                })}
            />

            <div>
                {/* Profile Image Section */}
                <Card
                    title={t({
                        id: 'settings.profile.avatar.title',
                        message: 'Profile picture'
                    })}
                    subtitle={t({
                        id: 'settings.profile.avatar.subtitle',
                        message: 'Saved as soon as you finish cropping.'
                    })}
                    className="mb-6">
                    <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
                        <div className="relative w-24 h-24 sm:w-28 sm:h-28">
                            <img
                                src={avatar}
                                alt={t({
                                    id: 'settings.profile.avatar.alt',
                                    message: 'Profile picture'
                                })}
                                className="w-full h-full rounded-full object-cover border-4 border-line-light shadow-lg"
                            />
                            <div className="absolute -bottom-1 -right-1">
                                <label
                                    htmlFor="avatar-input"
                                    className="group flex h-11 w-11 cursor-pointer items-center justify-center rounded-full">
                                    <span className="sr-only">
                                        <Trans id="settings.profile.avatar.change">
                                            Change profile picture
                                        </Trans>
                                    </span>
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
                            <p className="text-sm text-content-secondary mb-2">
                                <Trans id="settings.profile.avatar.select_hint">
                                    Select an image using the camera button.
                                </Trans>
                            </p>
                            <p className="text-xs text-content-hint">
                                <Trans id="settings.profile.avatar.size_hint">
                                    Recommended: 400 × 400 px, up to 5 MB
                                </Trans>
                            </p>
                        </div>
                    </div>
                </Card>

                {/* Cover Image Section */}
                <Card
                    title={t({
                        id: 'settings.profile.cover.title',
                        message: 'Cover image'
                    })}
                    subtitle={t({
                        id: 'settings.profile.cover.subtitle',
                        message: 'Shown at the top of your profile and saved as soon as you finish cropping.'
                    })}
                    className="mb-6">
                    <div className="space-y-4">
                        {cover ? (
                            <div className="relative group">
                                <div className="aspect-[3/1] w-full rounded-2xl overflow-hidden ring-1 ring-line/5">
                                    <img
                                        src={cover}
                                        alt={t({
                                            id: 'settings.profile.cover.alt',
                                            message: 'Cover image'
                                        })}
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                                <div className="absolute inset-0 bg-action bg-opacity-0 group-hover:bg-opacity-40 group-focus-within:bg-opacity-40 transition-all duration-200 rounded-2xl flex items-center justify-center opacity-0 group-hover:opacity-100 group-focus-within:opacity-100">
                                    <label
                                        htmlFor="cover-input"
                                        className="px-6 py-3 bg-surface hover:bg-surface-subtle rounded-xl text-sm font-semibold text-content cursor-pointer transition-colors shadow-lg focus-within:ring-2 focus-within:ring-line-strong">
                                        <Trans id="settings.profile.cover.change">
                                            Change image
                                        </Trans>
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
                                        <p className="text-sm font-semibold text-content-secondary mb-1">
                                            <Trans id="settings.profile.cover.add">
                                                Add cover image
                                            </Trans>
                                        </p>
                                        <p className="text-xs text-content-hint">
                                            <Trans id="settings.profile.cover.upload_hint">
                                                Click to upload an image
                                            </Trans>
                                        </p>
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
                                    <Trans id="settings.profile.cover.delete_title">
                                        Delete cover image
                                    </Trans>
                                </button>
                            </div>
                        )}
                        <div>
                            <p className="text-xs text-content-hint">
                                <Trans id="settings.profile.cover.size_hint">
                                    Recommended: 1500 × 500 px (3:1 ratio), up to 5 MB
                                </Trans>
                            </p>
                        </div>
                    </div>
                </Card>
            </div>

            <form onSubmit={handleSubmit(onSubmit)}>
                {/* Profile Information Section */}
                <Card
                    title={t({
                        id: 'settings.profile.basic_info.title',
                        message: 'Basic information'
                    })}
                    subtitle={t({
                        id: 'settings.profile.basic_info.subtitle',
                        message: 'Use the save button to apply changes to your bio and homepage.'
                    })}
                    className="mb-6">
                    <div className="mb-6">
                        <Input
                            density="compact"
                            label={t({
                                id: 'settings.profile.bio.label',
                                message: 'Bio'
                            })}
                            leftIcon={<UserRound aria-hidden="true" className="h-4 w-4" />}
                            multiline
                            rows={4}
                            placeholder={t({
                                id: 'settings.profile.bio.placeholder',
                                message: 'Share a little about yourself, your interests, expertise, or hobbies.'
                            })}
                            error={errors.bio?.message}
                            {...register('bio')}
                        />
                    </div>

                    <Input
                        density="compact"
                        label={t({
                            id: 'settings.profile.homepage.label',
                            message: 'Homepage'
                        })}
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
                        {isLoading
                            ? t({
                                id: 'settings.profile.saving',
                                message: 'Saving...'
                            })
                            : t({
                                id: 'settings.profile.save',
                                message: 'Save basic information'
                            })}
                    </Button>
                </div>
            </form>

            {imageCropConfig && (
                <ImageCropDialog
                    isOpen={Boolean(imageCropState)}
                    file={imageCropState?.file ?? null}
                    title={imageCropTitle}
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
