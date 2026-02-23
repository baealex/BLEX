import { useEffect, useRef, useState } from 'react';
import { useNavigate, useBlocker } from '@tanstack/react-router';
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { FloatingBottomBar, Send } from '@blex/ui';
import { CodeEditor } from '~/components/CodeEditor';
import { Button, Checkbox, Input } from '~/components/shared';
import { useConfirm } from '~/hooks/useConfirm';
import { toast } from '~/utils/toast';
import { cx } from '~/lib/classnames';
import {
    getBanner,
    getGlobalBanner,
    createBanner,
    updateBanner,
    deleteBanner,
    createGlobalBanner,
    updateGlobalBanner,
    deleteGlobalBanner,
    type BannerCreateData,
    type BannerUpdateData,
    type GlobalBannerCreateData,
    type GlobalBannerUpdateData
} from '~/lib/api/settings';
import BannerPreviewFrame from './BannerPreviewFrame';

type BannerScope = 'user' | 'global';
type BannerType = 'horizontal' | 'sidebar';
type BannerPosition = 'top' | 'bottom' | 'left' | 'right';
type BannerCreatePayload = BannerCreateData | GlobalBannerCreateData;
type BannerUpdatePayload = BannerUpdateData | GlobalBannerUpdateData;

const bannerSchema = z.object({
    title: z.string().trim().min(1, '배너 이름을 입력해주세요.').max(100, '배너 이름은 100자 이내여야 합니다.'),
    contentHtml: z.string().trim().min(1, '배너 HTML을 입력해주세요.'),
    bannerType: z.enum(['horizontal', 'sidebar']),
    position: z.enum(['top', 'bottom', 'left', 'right']),
    isActive: z.boolean(),
    order: z.number().int().min(0, '노출 순서는 0 이상이어야 합니다.')
});

type BannerFormInputs = z.infer<typeof bannerSchema>;

const defaultValues: BannerFormInputs = {
    title: '',
    contentHtml: '',
    bannerType: 'horizontal',
    position: 'top',
    isActive: true,
    order: 0
};

const typeLabels: Record<BannerType, string> = {
    horizontal: '줄배너',
    sidebar: '사이드배너'
};

const positionLabels: Record<BannerPosition, string> = {
    top: '상단',
    bottom: '하단',
    left: '좌측',
    right: '우측'
};
const positionOptions: BannerPosition[] = ['top', 'bottom', 'left', 'right'];

interface BannerEditorBaseProps {
    scope: BannerScope;
    bannerId?: number;
}

const BannerEditorBase = ({ scope, bannerId }: BannerEditorBaseProps) => {
    const isGlobal = scope === 'global';
    const isEditMode = bannerId !== undefined;
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { confirm } = useConfirm();
    const allowNavigationRef = useRef(false);
    const bannerLabel = isGlobal ? '전역 배너' : '배너';
    const [hasSelectedPosition, setHasSelectedPosition] = useState(isEditMode);

    const { data: bannerDetail } = useSuspenseQuery({
        queryKey: [isGlobal ? 'global-banner-detail' : 'banner-detail', bannerId],
        queryFn: async () => {
            if (!bannerId) {
                return null;
            }

            const { data } = isGlobal ? await getGlobalBanner(bannerId) : await getBanner(bannerId);
            if (data.status === 'DONE') {
                return data.body;
            }

            throw new Error(data.errorMessage || `${bannerLabel} 정보를 불러오는데 실패했습니다.`);
        }
    });

    const {
        register,
        handleSubmit,
        control,
        watch,
        setValue,
        reset,
        formState: { errors, isDirty }
    } = useForm<BannerFormInputs>({
        resolver: zodResolver(bannerSchema),
        defaultValues
    });

    const navigateToList = (replace = false) => {
        if (isGlobal) {
            navigate({
                to: '/global-banners',
                replace
            });
            return;
        }

        navigate({
            to: '/banners',
            replace
        });
    };

    useEffect(() => {
        if (!bannerDetail) {
            reset(defaultValues);
            if (!isEditMode) {
                setHasSelectedPosition(false);
            }
            return;
        }

        reset({
            title: bannerDetail.title,
            contentHtml: bannerDetail.contentHtml,
            bannerType: bannerDetail.bannerType,
            position: bannerDetail.position,
            isActive: bannerDetail.isActive,
            order: bannerDetail.order
        });
        setHasSelectedPosition(true);
    }, [bannerDetail, isEditMode, reset]);

    useBlocker({
        shouldBlockFn: async () => {
            if (!isDirty || allowNavigationRef.current) return false;

            const confirmed = await confirm({
                title: '저장하지 않은 변경사항',
                message: '변경사항이 저장되지 않았습니다. 페이지를 나가시겠습니까?',
                confirmText: '나가기',
                variant: 'danger'
            });
            return !confirmed;
        },
        enableBeforeUnload: () => isDirty && !allowNavigationRef.current
    });

    const invalidateQueries = () => {
        queryClient.invalidateQueries({ queryKey: [isGlobal ? 'global-banners' : 'banners'] });
        queryClient.invalidateQueries({ queryKey: [isGlobal ? 'global-banner-detail' : 'banner-detail'] });
    };

    const createMutation = useMutation({
        mutationFn: (payload: BannerCreatePayload) => (
            isGlobal
                ? createGlobalBanner(payload as GlobalBannerCreateData)
                : createBanner(payload as BannerCreateData)
        ),
        onSuccess: ({ data }) => {
            if (data.status === 'ERROR') {
                toast.error(data.errorMessage || `${bannerLabel} 생성에 실패했습니다.`);
                return;
            }

            toast.success(`${bannerLabel}가 생성되었습니다.`);
            invalidateQueries();
            allowNavigationRef.current = true;
            navigateToList(true);
        },
        onError: () => {
            toast.error(`${bannerLabel} 생성에 실패했습니다.`);
        }
    });

    const updateMutation = useMutation({
        mutationFn: (payload: BannerUpdatePayload) => {
            if (!bannerId) {
                throw new Error('bannerId is required');
            }

            return isGlobal
                ? updateGlobalBanner(bannerId, payload as GlobalBannerUpdateData)
                : updateBanner(bannerId, payload as BannerUpdateData);
        },
        onSuccess: ({ data }) => {
            if (data.status === 'ERROR') {
                toast.error(data.errorMessage || `${bannerLabel} 수정에 실패했습니다.`);
                return;
            }

            toast.success(`${bannerLabel}가 수정되었습니다.`);
            invalidateQueries();
            allowNavigationRef.current = true;
            navigateToList(true);
        },
        onError: () => {
            toast.error(`${bannerLabel} 수정에 실패했습니다.`);
        }
    });

    const deleteMutation = useMutation({
        mutationFn: () => {
            if (!bannerId) {
                throw new Error('bannerId is required');
            }

            return isGlobal ? deleteGlobalBanner(bannerId) : deleteBanner(bannerId);
        },
        onSuccess: ({ data }) => {
            if (data.status === 'ERROR') {
                toast.error(data.errorMessage || `${bannerLabel} 삭제에 실패했습니다.`);
                return;
            }

            toast.success(`${bannerLabel}가 삭제되었습니다.`);
            invalidateQueries();
            allowNavigationRef.current = true;
            navigateToList(true);
        },
        onError: () => {
            toast.error(`${bannerLabel} 삭제에 실패했습니다.`);
        }
    });

    const bannerType = watch('bannerType');
    const position = watch('position');
    const title = watch('title');
    const contentHtml = watch('contentHtml');
    const isActive = watch('isActive');

    const handleDelete = async () => {
        const confirmMessage = title
            ? `"${title}" 배너를 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.`
            : '이 배너를 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.';

        const confirmed = await confirm({
            title: `${bannerLabel} 삭제`,
            message: confirmMessage,
            confirmText: '삭제',
            variant: 'danger'
        });

        if (!confirmed) {
            return;
        }

        deleteMutation.mutate();
    };

    const onSubmit = (formData: BannerFormInputs) => {
        if (!isEditMode && !hasSelectedPosition) {
            toast.error('배너 위치를 먼저 선택해주세요.');
            return;
        }

        const payload: BannerCreatePayload = {
            title: formData.title,
            content_html: formData.contentHtml,
            banner_type: formData.bannerType,
            position: formData.position,
            is_active: formData.isActive,
            order: formData.order
        };

        if (isEditMode) {
            updateMutation.mutate(payload as BannerUpdatePayload);
            return;
        }

        createMutation.mutate(payload);
    };

    const handlePositionChange = (value: BannerPosition) => {
        const nextType: BannerType = value === 'top' || value === 'bottom' ? 'horizontal' : 'sidebar';
        setValue('bannerType', nextType, { shouldDirty: true });
        setValue('position', value, { shouldDirty: true });
        setHasSelectedPosition(true);
    };

    const isSaving = createMutation.isPending || updateMutation.isPending;
    const editorPanel = (
        <div className="space-y-5">
            {!isEditMode && !hasSelectedPosition && (
                <div className="rounded-2xl border border-warning-line bg-warning-surface px-4 py-3">
                    <p className="text-base font-extrabold text-warning sm:text-lg">
                        먼저 배너의 위치를 선택하세요.
                    </p>
                    <p className="mt-1 text-xs font-medium text-warning">
                        상단/하단/좌측/우측 중 하나를 누르면 타입과 위치가 자동 설정됩니다.
                    </p>
                </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
                {positionOptions.map((slot) => {
                    const active = hasSelectedPosition && slot === position;
                    return (
                        <button
                            key={slot}
                            type="button"
                            onClick={() => handlePositionChange(slot)}
                            className={cx(
                                'rounded-full border px-3 py-1 text-xs font-semibold transition-colors',
                                active ? 'border-line-strong bg-action text-content-inverted' : 'border-line bg-surface text-content hover:border-line-strong',
                                !hasSelectedPosition ? 'ring-2 ring-warning-line' : ''
                            )}>
                            {positionLabels[slot]}
                        </button>
                    );
                })}
                <span
                    className={cx(
                        'text-xs',
                        hasSelectedPosition ? 'text-content-hint' : 'font-semibold text-warning'
                    )}>
                    위치 선택 시 타입은 자동으로 맞춰집니다.
                </span>
            </div>

            <Input
                label="배너 이름"
                placeholder="예: 메인 공지 배너"
                error={errors.title?.message}
                {...register('title')}
            />

            <div className="grid gap-3 sm:grid-cols-2">
                <Input
                    type="number"
                    min={0}
                    label="노출 순서"
                    error={errors.order?.message}
                    {...register('order', { valueAsNumber: true })}
                />

                <div className="space-y-1.5">
                    <label className="ml-1 block text-sm font-medium text-content">
                        배너 활성화
                    </label>
                    <div className="min-h-12 rounded-lg border border-line bg-surface px-3 py-2">
                        <Checkbox
                            checked={isActive}
                            onCheckedChange={(checked) => setValue('isActive', checked, { shouldDirty: true })}
                            label="노출"
                            description="활성화된 배너만 노출"
                        />
                    </div>
                </div>
            </div>

            <div className="space-y-2">
                <label className="block text-sm font-semibold text-content">배너 HTML</label>
                <Controller
                    name="contentHtml"
                    control={control}
                    render={({ field }) => (
                        <CodeEditor
                            language="html"
                            value={field.value}
                            onChange={field.onChange}
                            height="380px"
                            error={errors.contentHtml?.message}
                        />
                    )}
                />
                <p className="text-xs text-content-secondary">
                    {isGlobal
                        ? '전역 배너는 스크립트를 포함할 수 있습니다.'
                        : '사용자 배너는 스크립트 사용이 제한됩니다.'}
                </p>
            </div>
        </div>
    );

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="min-h-screen bg-surface pb-16">
            <div className="sticky top-0 z-10 border-b border-line bg-surface">
                <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 md:px-6">
                    <button
                        type="button"
                        className="flex items-center gap-2 py-2 text-sm text-content-secondary transition-colors hover:text-content active:text-content-secondary"
                        onClick={() => navigateToList()}>
                        <i className="fas fa-arrow-left" />
                        <span>목록으로</span>
                    </button>

                    <span className="text-sm text-content-secondary">
                        {isEditMode && title ? title : isEditMode ? `${bannerLabel} 수정` : `${bannerLabel} 생성`}
                    </span>
                </div>
            </div>

            <div className="mx-auto max-w-[1720px] space-y-6 px-4 pb-8 pt-6 md:px-6">
                <BannerPreviewFrame
                    contentHtml={contentHtml}
                    position={position}
                    hasSelectedPosition={hasSelectedPosition}
                    onPositionChange={handlePositionChange}
                    editorPanel={editorPanel}
                />
            </div>

            <FloatingBottomBar>
                {isEditMode && (
                    <>
                        <Button
                            type="button"
                            variant="ghost"
                            size="md"
                            isLoading={deleteMutation.isPending}
                            disabled={isSaving}
                            onClick={handleDelete}
                            className="!rounded-full !text-danger hover:!bg-danger-surface hover:!text-danger">
                            삭제
                        </Button>
                        <div className="mx-1 h-8 w-px bg-line/60" />
                    </>
                )}

                <div className="hidden items-center px-1.5 text-xs text-content-secondary sm:flex">
                    {typeLabels[bannerType]} · {positionLabels[position]}
                </div>

                <Button
                    type="submit"
                    variant="primary"
                    className="!rounded-full"
                    leftIcon={!isSaving ? <Send className="h-4 w-4" /> : undefined}
                    isLoading={isSaving}
                    disabled={deleteMutation.isPending}>
                    {isSaving ? '저장 중...' : isEditMode ? '수정' : '생성'}
                </Button>
            </FloatingBottomBar>
        </form>
    );
};

export default BannerEditorBase;
