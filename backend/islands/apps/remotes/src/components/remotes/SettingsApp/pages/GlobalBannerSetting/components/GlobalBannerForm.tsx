import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Input, Checkbox } from '~/components/shared';
import { CodeEditor } from '~/components/CodeEditor';
import type { GlobalBannerData, GlobalBannerCreateData } from '~/lib/api/settings';

const bannerSchema = z.object({
    title: z.string().min(1, '배너 이름을 입력해주세요.').max(100, '배너 이름은 100자 이내여야 합니다.'),
    contentHtml: z.string().min(1, '배너 내용을 입력해주세요.'),
    bannerType: z.enum(['horizontal', 'sidebar']),
    position: z.enum(['top', 'bottom', 'left', 'right']),
    isActive: z.boolean().optional(),
    order: z.number().optional()
});

type BannerFormInputs = z.infer<typeof bannerSchema>;

interface GlobalBannerFormProps {
    banner?: GlobalBannerData;
    onSubmit: (data: GlobalBannerCreateData) => void;
    onCancel: () => void;
    isLoading: boolean;
}

export const GlobalBannerForm = ({ banner, onSubmit, onCancel, isLoading }: GlobalBannerFormProps) => {
    const {
        register, handleSubmit, watch, setValue, control, formState: { errors }
    } = useForm<BannerFormInputs>({
        resolver: zodResolver(bannerSchema),
        defaultValues: banner ? {
            title: banner.title,
            contentHtml: banner.contentHtml,
            bannerType: banner.bannerType,
            position: banner.position,
            isActive: banner.isActive,
            order: banner.order
        } : {
            title: '',
            contentHtml: '',
            bannerType: 'horizontal',
            position: 'top',
            isActive: true,
            order: 0
        }
    });

    const bannerType = watch('bannerType');

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
        onSubmit({
            content_html: data.contentHtml,
            title: data.title,
            banner_type: data.bannerType,
            position: data.position,
            is_active: data.isActive,
            order: data.order
        });
    };

    return (
        <form onSubmit={handleSubmit(handleFormSubmit)}>
            <div className="p-6 space-y-6">
                <div className="space-y-2">
                    <label className="block text-sm font-semibold text-gray-900">
                        배너 이름
                    </label>
                    <Input
                        placeholder="예: 메인 공지사항, 사이드 링크 모음"
                        error={errors.title?.message}
                        className="text-base"
                        {...register('title')}
                    />
                    <p className="text-xs text-gray-500">관리용 이름입니다. 사용자에게는 표시되지 않습니다.</p>
                </div>

                <div className="space-y-3">
                    <label className="block text-sm font-semibold text-gray-900">
                        배너 타입
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                        <label
                            className={`relative flex items-center p-5 cursor-pointer border-2 rounded-2xl transition-all duration-200 ${
                            watch('bannerType') === 'horizontal'
                                ? 'border-gray-900 bg-gray-50 shadow-sm'
                                : 'border-gray-200 hover:border-gray-300 bg-white'
                        }`}>
                            <input
                                type="radio"
                                value="horizontal"
                                {...register('bannerType')}
                                className="sr-only"
                            />
                            <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                    <svg className={`w-5 h-5 ${watch('bannerType') === 'horizontal' ? 'text-gray-700' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                                    </svg>
                                    <span className={`text-sm font-semibold ${watch('bannerType') === 'horizontal' ? 'text-gray-900' : 'text-gray-900'}`}>
                                        줄배너
                                    </span>
                                </div>
                                <p className="text-xs text-gray-500">가로 전체 너비</p>
                            </div>
                            {watch('bannerType') === 'horizontal' && (
                                <div className="absolute top-3 right-3">
                                    <svg className="w-5 h-5 text-gray-700" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                    </svg>
                                </div>
                            )}
                        </label>

                        <label
                            className={`relative flex items-center p-5 cursor-pointer border-2 rounded-2xl transition-all duration-200 ${
                            watch('bannerType') === 'sidebar'
                                ? 'border-gray-900 bg-gray-50 shadow-sm'
                                : 'border-gray-200 hover:border-gray-300 bg-white'
                        }`}>
                            <input
                                type="radio"
                                value="sidebar"
                                {...register('bannerType')}
                                className="sr-only"
                            />
                            <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                    <svg className={`w-5 h-5 ${watch('bannerType') === 'sidebar' ? 'text-gray-700' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 4H5a2 2 0 00-2 2v12a2 2 0 002 2h4m0-16v16m0-16h10a2 2 0 012 2v12a2 2 0 01-2 2H9" />
                                    </svg>
                                    <span className={`text-sm font-semibold ${watch('bannerType') === 'sidebar' ? 'text-gray-900' : 'text-gray-900'}`}>
                                        사이드배너
                                    </span>
                                </div>
                                <p className="text-xs text-gray-500">좌우 측면</p>
                            </div>
                            {watch('bannerType') === 'sidebar' && (
                                <div className="absolute top-3 right-3">
                                    <svg className="w-5 h-5 text-gray-700" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                    </svg>
                                </div>
                            )}
                        </label>
                    </div>
                </div>

                <div className="space-y-3">
                    <label className="block text-sm font-semibold text-gray-900">
                        배너 위치
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                        {bannerType === 'horizontal' ? (
                            <>
                                <label
                                    className={`relative flex items-center p-5 cursor-pointer border-2 rounded-2xl transition-all duration-200 ${
                                    watch('position') === 'top'
                                        ? 'border-gray-900 bg-gray-50 shadow-sm'
                                        : 'border-gray-200 hover:border-gray-300 bg-white'
                                }`}>
                                    <input
                                        type="radio"
                                        value="top"
                                        {...register('position')}
                                        className="sr-only"
                                    />
                                    <span className={`text-sm font-semibold ${watch('position') === 'top' ? 'text-gray-900' : 'text-gray-900'}`}>
                                        상단
                                    </span>
                                    {watch('position') === 'top' && (
                                        <div className="absolute top-3 right-3">
                                            <svg className="w-5 h-5 text-gray-700" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                            </svg>
                                        </div>
                                    )}
                                </label>
                                <label
                                    className={`relative flex items-center p-5 cursor-pointer border-2 rounded-2xl transition-all duration-200 ${
                                    watch('position') === 'bottom'
                                        ? 'border-gray-900 bg-gray-50 shadow-sm'
                                        : 'border-gray-200 hover:border-gray-300 bg-white'
                                }`}>
                                    <input
                                        type="radio"
                                        value="bottom"
                                        {...register('position')}
                                        className="sr-only"
                                    />
                                    <span className={`text-sm font-semibold ${watch('position') === 'bottom' ? 'text-gray-900' : 'text-gray-900'}`}>
                                        하단
                                    </span>
                                    {watch('position') === 'bottom' && (
                                        <div className="absolute top-3 right-3">
                                            <svg className="w-5 h-5 text-gray-700" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                            </svg>
                                        </div>
                                    )}
                                </label>
                            </>
                        ) : (
                            <>
                                <label
                                    className={`relative flex items-center p-5 cursor-pointer border-2 rounded-2xl transition-all duration-200 ${
                                    watch('position') === 'left'
                                        ? 'border-gray-900 bg-gray-50 shadow-sm'
                                        : 'border-gray-200 hover:border-gray-300 bg-white'
                                }`}>
                                    <input
                                        type="radio"
                                        value="left"
                                        {...register('position')}
                                        className="sr-only"
                                    />
                                    <span className={`text-sm font-semibold ${watch('position') === 'left' ? 'text-gray-900' : 'text-gray-900'}`}>
                                        좌측
                                    </span>
                                    {watch('position') === 'left' && (
                                        <div className="absolute top-3 right-3">
                                            <svg className="w-5 h-5 text-gray-700" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                            </svg>
                                        </div>
                                    )}
                                </label>
                                <label
                                    className={`relative flex items-center p-5 cursor-pointer border-2 rounded-2xl transition-all duration-200 ${
                                    watch('position') === 'right'
                                        ? 'border-gray-900 bg-gray-50 shadow-sm'
                                        : 'border-gray-200 hover:border-gray-300 bg-white'
                                }`}>
                                    <input
                                        type="radio"
                                        value="right"
                                        {...register('position')}
                                        className="sr-only"
                                    />
                                    <span className={`text-sm font-semibold ${watch('position') === 'right' ? 'text-gray-900' : 'text-gray-900'}`}>
                                        우측
                                    </span>
                                    {watch('position') === 'right' && (
                                        <div className="absolute top-3 right-3">
                                            <svg className="w-5 h-5 text-gray-700" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                            </svg>
                                        </div>
                                    )}
                                </label>
                            </>
                        )}
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="block text-sm font-semibold text-gray-900">
                        배너 HTML
                    </label>
                    <Controller
                        name="contentHtml"
                        control={control}
                        render={({ field }) => (
                            <CodeEditor
                                language="html"
                                value={field.value}
                                onChange={field.onChange}
                                height="300px"
                                error={errors.contentHtml?.message}
                            />
                        )}
                    />
                    <p className="text-xs text-gray-500">HTML 코드를 입력하세요. 관리자 전용이므로 스크립트가 허용됩니다.</p>
                </div>

                <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                    <Checkbox
                        checked={watch('isActive') ?? true}
                        onCheckedChange={(checked) => setValue('isActive', checked)}
                        label="배너 활성화"
                        description="활성화된 배너만 사용자에게 표시됩니다."
                    />
                </div>
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
                <Button
                    type="button"
                    variant="secondary"
                    size="md"
                    onClick={onCancel}
                    disabled={isLoading}>
                    취소
                </Button>
                <Button
                    type="submit"
                    variant="primary"
                    size="md"
                    isLoading={isLoading}
                    leftIcon={
                        !isLoading ? (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                        ) : undefined
                    }>
                    {isLoading ? '저장 중...' : banner ? '배너 수정' : '배너 생성'}
                </Button>
            </div>
        </form>
    );
};
