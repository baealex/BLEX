import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Input } from '~/components/shared';
import type { BannerData, BannerCreateData } from '~/lib/api/settings';

const bannerSchema = z.object({
    title: z.string().min(1, '배너 이름을 입력해주세요.').max(100, '배너 이름은 100자 이내여야 합니다.'),
    content_html: z.string().min(1, '배너 내용을 입력해주세요.'),
    banner_type: z.enum(['horizontal', 'sidebar']),
    position: z.enum(['top', 'bottom', 'left', 'right']),
    is_active: z.boolean().optional(),
    order: z.number().optional()
});

type BannerFormInputs = z.infer<typeof bannerSchema>;

interface BannerFormProps {
    banner?: BannerData;
    onSubmit: (data: BannerCreateData) => void;
    onCancel: () => void;
    isLoading: boolean;
}

export const BannerForm = ({ banner, onSubmit, onCancel, isLoading }: BannerFormProps) => {
    const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<BannerFormInputs>({
        resolver: zodResolver(bannerSchema),
        defaultValues: banner ? {
            title: banner.title,
            content_html: banner.content_html,
            banner_type: banner.banner_type,
            position: banner.position,
            is_active: banner.is_active,
            order: banner.order
        } : {
            title: '',
            content_html: '',
            banner_type: 'horizontal',
            position: 'top',
            is_active: true,
            order: 0
        }
    });

    const bannerType = watch('banner_type');

    // Adjust position when banner type changes
    useEffect(() => {
        if (bannerType === 'horizontal') {
            const currentPosition = watch('position');
            if (currentPosition === 'left' || currentPosition === 'right') {
                setValue('position', 'top');
            }
        } else if (bannerType === 'sidebar') {
            const currentPosition = watch('position');
            if (currentPosition === 'top' || currentPosition === 'bottom') {
                setValue('position', 'left');
            }
        }
    }, [bannerType, setValue, watch]);

    const handleFormSubmit = (data: BannerFormInputs) => {
        onSubmit(data);
    };

    return (
        <form onSubmit={handleSubmit(handleFormSubmit)}>
            <div className="space-y-6">
                <Input
                    label="배너 이름"
                    placeholder="예: 메인 공지사항, 사이드 링크 모음"
                    error={errors.title?.message}
                    {...register('title')}
                />

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        배너 타입
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                        <label className="relative flex items-center p-4 cursor-pointer border rounded-lg hover:bg-gray-50 transition-colors">
                            <input
                                type="radio"
                                value="horizontal"
                                {...register('banner_type')}
                                className="w-4 h-4 text-blue-600"
                            />
                            <div className="ml-3">
                                <span className="text-sm font-medium text-gray-900">줄배너</span>
                                <p className="text-xs text-gray-500">가로 전체</p>
                            </div>
                        </label>
                        <label className="relative flex items-center p-4 cursor-pointer border rounded-lg hover:bg-gray-50 transition-colors">
                            <input
                                type="radio"
                                value="sidebar"
                                {...register('banner_type')}
                                className="w-4 h-4 text-blue-600"
                            />
                            <div className="ml-3">
                                <span className="text-sm font-medium text-gray-900">사이드배너</span>
                                <p className="text-xs text-gray-500">좌우 측면</p>
                            </div>
                        </label>
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        배너 위치
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                        {bannerType === 'horizontal' ? (
                            <>
                                <label className="relative flex items-center p-4 cursor-pointer border rounded-lg hover:bg-gray-50 transition-colors">
                                    <input
                                        type="radio"
                                        value="top"
                                        {...register('position')}
                                        className="w-4 h-4 text-blue-600"
                                    />
                                    <span className="ml-3 text-sm font-medium text-gray-900">상단</span>
                                </label>
                                <label className="relative flex items-center p-4 cursor-pointer border rounded-lg hover:bg-gray-50 transition-colors">
                                    <input
                                        type="radio"
                                        value="bottom"
                                        {...register('position')}
                                        className="w-4 h-4 text-blue-600"
                                    />
                                    <span className="ml-3 text-sm font-medium text-gray-900">하단</span>
                                </label>
                            </>
                        ) : (
                            <>
                                <label className="relative flex items-center p-4 cursor-pointer border rounded-lg hover:bg-gray-50 transition-colors">
                                    <input
                                        type="radio"
                                        value="left"
                                        {...register('position')}
                                        className="w-4 h-4 text-blue-600"
                                    />
                                    <span className="ml-3 text-sm font-medium text-gray-900">좌측</span>
                                </label>
                                <label className="relative flex items-center p-4 cursor-pointer border rounded-lg hover:bg-gray-50 transition-colors">
                                    <input
                                        type="radio"
                                        value="right"
                                        {...register('position')}
                                        className="w-4 h-4 text-blue-600"
                                    />
                                    <span className="ml-3 text-sm font-medium text-gray-900">우측</span>
                                </label>
                            </>
                        )}
                    </div>
                </div>

                <Input
                    label="배너 HTML"
                    multiline
                    rows={8}
                    placeholder='<div style="padding: 1rem; background: #f3f4f6; text-align: center;">배너 내용</div>'
                    error={errors.content_html?.message}
                    {...register('content_html')}
                />

                <div className="flex items-center space-x-3">
                    <input
                        type="checkbox"
                        {...register('is_active')}
                        className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <label className="text-sm font-medium text-gray-900">
                        배너 활성화
                    </label>
                </div>

                <div className="flex gap-3">
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
                        {isLoading ? '저장 중...' : banner ? '배너 수정' : '배너 생성'}
                    </Button>
                    <Button
                        type="button"
                        variant="secondary"
                        size="md"
                        onClick={onCancel}
                        disabled={isLoading}>
                        취소
                    </Button>
                </div>
            </div>
        </form>
    );
};
