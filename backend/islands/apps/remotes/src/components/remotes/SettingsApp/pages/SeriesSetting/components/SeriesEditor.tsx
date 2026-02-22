import { useEffect, useRef } from 'react';
import { Link, useNavigate, useBlocker } from '@tanstack/react-router';
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from '~/utils/toast';
import { useConfirm } from '~/hooks/useConfirm';
import { Button, Input } from '~/components/shared';
import { FloatingBottomBar, Send } from '@blex/ui';
import {
    getSeriesDetail,
    getAvailablePosts,
    createSeries,
    updateSeries,
    deleteSeriesById
} from '~/lib/api/settings';
import PostSelector from './PostSelector';

const seriesSchema = z.object({
    name: z.string().trim().min(1, '시리즈 제목을 입력해주세요.').max(50, '시리즈 제목은 50자 이내여야 합니다.'),
    description: z.string().trim().max(500, '시리즈 설명은 500자 이내여야 합니다.'),
    postIds: z.array(z.number())
});

type SeriesFormInputs = z.infer<typeof seriesSchema>;

const defaultValues: SeriesFormInputs = {
    name: '',
    description: '',
    postIds: []
};

interface SeriesEditorProps {
    seriesId?: number;
}

const SeriesEditor = ({ seriesId }: SeriesEditorProps) => {
    const isEditMode = seriesId !== undefined;
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { confirm } = useConfirm();
    const allowNavigationRef = useRef(false);

    const { data: seriesDetail } = useSuspenseQuery({
        queryKey: ['series-detail', seriesId],
        queryFn: async () => {
            if (!seriesId) {
                return null;
            }

            const { data } = await getSeriesDetail(seriesId);
            if (data.status === 'DONE') {
                return data.body;
            }
            throw new Error(data.errorMessage || '시리즈 정보를 불러오는데 실패했습니다.');
        }
    });

    const { data: availablePosts } = useSuspenseQuery({
        queryKey: ['series-available-posts', seriesId],
        queryFn: async () => {
            const { data } = await getAvailablePosts(seriesId);
            if (data.status === 'DONE') {
                return data.body;
            }
            throw new Error(data.errorMessage || '포스트 목록을 불러오는데 실패했습니다.');
        }
    });

    const {
        register,
        handleSubmit,
        watch,
        setValue,
        reset,
        formState: { errors, isDirty }
    } = useForm<SeriesFormInputs>({
        resolver: zodResolver(seriesSchema),
        defaultValues
    });

    useEffect(() => {
        if (!seriesDetail) {
            reset(defaultValues);
            return;
        }

        reset({
            name: seriesDetail.name,
            description: seriesDetail.description ?? '',
            postIds: seriesDetail.postIds ?? []
        });
    }, [seriesDetail, reset]);

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

    const invalidateSeriesQueries = () => {
        queryClient.invalidateQueries({ queryKey: ['series-setting'] });
        queryClient.invalidateQueries({ queryKey: ['series-detail'] });
        queryClient.invalidateQueries({ queryKey: ['series-available-posts'] });
    };

    const createMutation = useMutation({
        mutationFn: (formData: SeriesFormInputs) => createSeries({
            name: formData.name,
            description: formData.description,
            post_ids: formData.postIds
        }),
        onSuccess: ({ data }) => {
            if (data.status === 'ERROR') {
                toast.error(data.errorMessage || '시리즈 생성에 실패했습니다.');
                return;
            }

            toast.success('시리즈가 생성되었습니다.');
            invalidateSeriesQueries();
            allowNavigationRef.current = true;
            navigate({
                to: '/series',
                replace: true
            });
        },
        onError: () => {
            toast.error('시리즈 생성에 실패했습니다.');
        }
    });

    const updateMutation = useMutation({
        mutationFn: (formData: SeriesFormInputs) => {
            if (!seriesId) {
                throw new Error('seriesId is required');
            }

            return updateSeries(seriesId, {
                name: formData.name,
                description: formData.description,
                post_ids: formData.postIds
            });
        },
        onSuccess: ({ data }) => {
            if (data.status === 'ERROR') {
                toast.error(data.errorMessage || '시리즈 수정에 실패했습니다.');
                return;
            }

            toast.success('시리즈가 수정되었습니다.');
            invalidateSeriesQueries();
            allowNavigationRef.current = true;
            navigate({
                to: '/series',
                replace: true
            });
        },
        onError: () => {
            toast.error('시리즈 수정에 실패했습니다.');
        }
    });

    const deleteMutation = useMutation({
        mutationFn: () => {
            if (!seriesId) {
                throw new Error('seriesId is required');
            }
            return deleteSeriesById(seriesId);
        },
        onSuccess: ({ data }) => {
            if (data.status === 'ERROR') {
                toast.error(data.errorMessage || '시리즈 삭제에 실패했습니다.');
                return;
            }

            toast.success('시리즈가 삭제되었습니다.');
            invalidateSeriesQueries();
            allowNavigationRef.current = true;
            navigate({
                to: '/series',
                replace: true
            });
        },
        onError: () => {
            toast.error('시리즈 삭제에 실패했습니다.');
        }
    });

    const handleDelete = async () => {
        const confirmed = await confirm({
            title: '시리즈 삭제',
            message: `"${titleValue}" 시리즈를 삭제하면 연결된 글은 유지되고 시리즈 연결만 해제됩니다.\n\n이 작업은 되돌릴 수 없습니다. 계속할까요?`,
            confirmText: '삭제',
            variant: 'danger'
        });

        if (!confirmed) {
            return;
        }

        deleteMutation.mutate();
    };

    const onSubmit = (formData: SeriesFormInputs) => {
        if (isEditMode) {
            updateMutation.mutate(formData);
            return;
        }

        createMutation.mutate(formData);
    };

    const titleValue = watch('name');
    const selectedPostIds = watch('postIds');
    const isSaving = createMutation.isPending || updateMutation.isPending;

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="min-h-screen bg-white pb-16">
            <div className="sticky top-0 z-10 bg-white border-b border-gray-200">
                <div className="max-w-7xl mx-auto px-4 md:px-6 h-14 flex items-center justify-between">
                    <Link
                        to="/series"
                        className="flex items-center gap-2 py-2 text-sm text-gray-600 hover:text-gray-900 active:text-gray-500 transition-colors">
                        <i className="fas fa-arrow-left" />
                        <span>목록으로</span>
                    </Link>
                    <span className="text-sm text-gray-500">
                        {isEditMode && titleValue ? titleValue : isEditMode ? '시리즈 수정' : '시리즈 생성'}
                    </span>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 md:px-6 pt-8 pb-8 space-y-8">
                <div className="space-y-2">
                    <div className="relative">
                        <input
                            id="series-name"
                            type="text"
                            maxLength={50}
                            placeholder="시리즈 제목을 입력해주세요"
                            className="w-full text-3xl font-bold text-gray-900 placeholder-gray-300 border-none outline-none bg-transparent pr-20"
                            {...register('name')}
                        />
                        <span className={`absolute right-0 top-1/2 -translate-y-1/2 text-xs font-medium ${titleValue.length > 40 ? 'text-red-500' : 'text-gray-400'}`}>
                            {titleValue.length}/50
                        </span>
                    </div>
                    {errors.name?.message && (
                        <p className="text-sm text-red-600">{errors.name.message}</p>
                    )}
                </div>

                <Input
                    label="시리즈 설명"
                    multiline
                    rows={5}
                    placeholder="이 시리즈에서 다루는 내용을 입력해주세요."
                    maxLength={500}
                    error={errors.description?.message}
                    helperText="설명은 선택 입력입니다."
                    {...register('description')}
                />

                <PostSelector
                    posts={availablePosts}
                    selectedPostIds={selectedPostIds}
                    onChange={(postIds) => {
                        setValue('postIds', postIds, { shouldDirty: true });
                    }}
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
                        className="!rounded-full !text-red-500 hover:!text-red-700 hover:!bg-red-50">
                        삭제
                    </Button>
                    <div className="w-px h-8 bg-gray-200/60 mx-1" />
                </>
                    )}

                <div className="hidden sm:flex items-center px-1.5 text-xs text-gray-500">
                    {selectedPostIds.length}개의 포스트 선택
                </div>

                <Button
                    type="submit"
                    variant="primary"
                    className="!rounded-full"
                    leftIcon={!isSaving ? <Send className="w-4 h-4" /> : undefined}
                    isLoading={isSaving}
                    disabled={deleteMutation.isPending}>
                    {isSaving ? '저장 중...' : isEditMode ? '수정' : '생성'}
                </Button>
            </FloatingBottomBar>
        </form>
    );
};

export default SeriesEditor;
