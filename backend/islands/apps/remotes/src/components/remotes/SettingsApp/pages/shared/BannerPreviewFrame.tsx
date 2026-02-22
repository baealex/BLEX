import { cx } from '~/lib/classnames';
import type { ReactNode } from 'react';

type BannerPosition = 'top' | 'bottom' | 'left' | 'right';

interface BannerPreviewFrameProps {
    contentHtml: string;
    position: BannerPosition;
    hasSelectedPosition: boolean;
    onPositionChange: (position: BannerPosition) => void;
    editorPanel: ReactNode;
}

const positionLabels: Record<BannerPosition, string> = {
    top: '상단',
    bottom: '하단',
    left: '좌측',
    right: '우측'
};

const BannerPreviewFrame = ({
    contentHtml,
    position,
    hasSelectedPosition,
    onPositionChange,
    editorPanel
}: BannerPreviewFrameProps) => {
    const hasHtml = contentHtml.trim().length > 0;
    const mutedPostClass = hasSelectedPosition ? 'opacity-100' : 'opacity-50';
    const today = new Date();
    const todayLabel = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    const renderInlineSlot = (slot: BannerPosition) => {
        const selected = hasSelectedPosition && slot === position;
        return (
            <button
                type="button"
                onClick={() => onPositionChange(slot)}
                className="block w-full text-left">
                {selected ? (
                    hasHtml ? (
                        <div dangerouslySetInnerHTML={{ __html: contentHtml }} />
                    ) : (
                        <div className="py-2 text-xs text-gray-400">HTML을 입력하면 {positionLabels[slot]}에 배너가 표시됩니다.</div>
                    )
                ) : (
                    <div
                        className={cx(
                        'rounded-xl border border-dashed px-3 py-4 text-center text-xs font-semibold transition-colors',
                        hasSelectedPosition
                            ? 'border-gray-200 text-gray-300 hover:border-gray-300 hover:text-gray-400'
                            : 'border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100'
                    )}>
                        {positionLabels[slot]} 위치 선택
                    </div>
                )}
            </button>
        );
    };

    const renderSidebarSlot = (slot: BannerPosition) => {
        const selected = hasSelectedPosition && slot === position;
        return (
            <button
                type="button"
                onClick={() => onPositionChange(slot)}
                className={cx('block w-full text-left', !selected ? 'hover:opacity-80' : '')}>
                {selected ? (
                    hasHtml ? (
                        <div dangerouslySetInnerHTML={{ __html: contentHtml }} />
                    ) : (
                        <div className="py-2 text-xs text-gray-400">{positionLabels[slot]}에 배너가 표시됩니다.</div>
                    )
                ) : (
                    <div
                        className={cx(
                        'rounded-xl border border-dashed px-3 py-4 text-center text-xs font-semibold',
                        hasSelectedPosition
                            ? 'border-gray-200 text-gray-300'
                            : 'border-amber-300 bg-amber-50 text-amber-800'
                    )}>
                        {positionLabels[slot]} 위치 선택
                    </div>
                )}
            </button>
        );
    };

    return (
        <div className="relative w-full px-4 md:px-6">
            <div className="flex justify-center gap-6">
                <aside className="hidden w-64 flex-shrink-0 xl:block">
                    <div className="sticky top-28 space-y-4">
                        {renderSidebarSlot('left')}
                    </div>
                </aside>

                <div className="max-w-4xl w-full">
                    <div className="mt-6" role="main">
                        <article lang="ko">
                            <div className={cx('mb-12 transition-opacity sm:mb-16', mutedPostClass)}>
                                <div className="mb-6 flex items-center gap-2">
                                    <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-900 px-3 py-1 text-xs font-semibold text-white">
                                        <i className="fas fa-layer-group text-[10px] opacity-70" />
                                        Series
                                    </span>
                                    <span className="text-xs font-medium text-gray-400">1 / 5</span>
                                </div>

                                <h1 className="mb-3 break-words text-2xl font-bold leading-tight tracking-tight text-gray-900 sm:text-3xl lg:text-4xl">
                                    포스트 제목이 이 위치에 표시됩니다
                                </h1>
                                <p className="mb-8 text-lg font-medium leading-relaxed text-gray-500 sm:text-xl">
                                    포스트 서브타이틀 영역
                                </p>

                                <div className="flex items-center gap-4 border-b border-gray-100 pb-8 text-sm">
                                    <div className="h-10 w-10 rounded-full bg-gray-200 ring-2 ring-gray-100" />
                                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                        <span className="font-semibold text-gray-900">작성자</span>
                                        <span className="text-gray-300">·</span>
                                        <span className="text-gray-500">{todayLabel}</span>
                                        <span className="text-gray-300">·</span>
                                        <span className="text-gray-500">5분 소요</span>
                                    </div>
                                </div>
                            </div>

                            <div className={cx('mb-12 transition-opacity sm:mb-16', mutedPostClass)}>
                                <div className="h-56 w-full rounded-2xl bg-gradient-to-br from-gray-200 to-gray-300 ring-1 ring-gray-900/5 sm:h-64" />
                            </div>

                            <div className="mb-16">
                                {renderInlineSlot('top')}
                            </div>

                            <div className="blog-post-content mb-16 break-words">
                                {editorPanel}
                            </div>

                            <div className={cx('mb-16 transition-opacity', mutedPostClass)}>
                                <div className="flex flex-wrap gap-2">
                                    <span className="inline-flex items-center rounded-full border border-gray-100 bg-gray-50 px-4 py-2 text-sm font-medium text-gray-600">#태그1</span>
                                    <span className="inline-flex items-center rounded-full border border-gray-100 bg-gray-50 px-4 py-2 text-sm font-medium text-gray-600">#태그2</span>
                                    <span className="inline-flex items-center rounded-full border border-gray-100 bg-gray-50 px-4 py-2 text-sm font-medium text-gray-600">#태그3</span>
                                </div>
                            </div>

                            <div className="mb-16">
                                {renderInlineSlot('bottom')}
                            </div>
                        </article>
                    </div>
                </div>

                <aside className="hidden w-64 flex-shrink-0 xl:block">
                    <div className="sticky top-28 space-y-4">
                        <div className="text-xs text-gray-400">
                            TOC / 우측 사이드바
                        </div>
                        {renderSidebarSlot('right')}
                    </div>
                </aside>
            </div>
        </div>
    );
};

export default BannerPreviewFrame;
