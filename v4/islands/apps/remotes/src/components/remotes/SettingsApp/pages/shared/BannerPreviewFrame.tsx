import { cx } from '~/lib/classnames';
import type { ReactNode } from 'react';
import { Trans, useLingui } from '@lingui/react/macro';
import { Layers3 } from '@blex/ui/icons';
import { normalizeLocale } from '~/i18n/locale';
import type { BannerPosition } from './bannerI18n';

interface BannerPreviewFrameProps {
    contentHtml: string;
    position: BannerPosition;
    hasSelectedPosition: boolean;
    onPositionChange: (position: BannerPosition) => void;
    editorPanel: ReactNode;
}

const BannerPreviewFrame = ({
    contentHtml,
    position,
    hasSelectedPosition,
    onPositionChange,
    editorPanel
}: BannerPreviewFrameProps) => {
    const { i18n } = useLingui();
    const locale = normalizeLocale(i18n.locale);
    const hasHtml = contentHtml.trim().length > 0;
    const mutedPostClass = hasSelectedPosition ? 'opacity-100' : 'opacity-50';
    const todayLabel = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date());

    const renderInlineSlot = (slot: BannerPosition) => {
        const selected = hasSelectedPosition && slot === position;

        if (selected) {
            return (
                <div
                    role="group"
                    className="min-h-11"
                    aria-label={i18n._({
                        id: 'settings.banners.preview.position_selected',
                        message: '{position, select, top {Top position selected} bottom {Bottom position selected} left {Left position selected} other {Right position selected}}',
                        values: { position: slot }
                    })}>
                    {hasHtml ? (
                        <div dangerouslySetInnerHTML={{ __html: contentHtml }} />
                    ) : (
                        <div className="py-2 text-xs text-content-hint">
                            {i18n._({
                                id: 'settings.banners.preview.empty_slot',
                                message: '{position, select, top {Enter HTML to display the banner at the top.} bottom {Enter HTML to display the banner at the bottom.} left {Enter HTML to display the banner in the left sidebar.} other {Enter HTML to display the banner in the right sidebar.}}',
                                values: { position: slot }
                            })}
                        </div>
                    )}
                </div>
            );
        }

        return (
            <button
                type="button"
                aria-pressed="false"
                onClick={() => onPositionChange(slot)}
                className="block min-h-11 w-full text-left">
                <div
                    className={cx(
                        'rounded-xl border border-dashed px-3 py-4 text-center text-xs font-semibold transition-colors',
                        hasSelectedPosition
                            ? 'border-line text-content-hint hover:border-line hover:text-content-hint'
                            : 'border-warning-line bg-warning-surface text-warning hover:bg-warning-surface'
                    )}>
                    {i18n._({
                        id: 'settings.banners.preview.select_position',
                        message: '{position, select, top {Select top position} bottom {Select bottom position} left {Select left position} other {Select right position}}',
                        values: { position: slot }
                    })}
                </div>
            </button>
        );
    };

    const renderSidebarSlot = (slot: BannerPosition) => {
        const selected = hasSelectedPosition && slot === position;

        if (selected) {
            return (
                <div
                    role="group"
                    className="min-h-11"
                    aria-label={i18n._({
                        id: 'settings.banners.preview.position_selected',
                        message: '{position, select, top {Top position selected} bottom {Bottom position selected} left {Left position selected} other {Right position selected}}',
                        values: { position: slot }
                    })}>
                    {hasHtml ? (
                        <div dangerouslySetInnerHTML={{ __html: contentHtml }} />
                    ) : (
                        <div className="py-2 text-xs text-content-hint">
                            {i18n._({
                                id: 'settings.banners.preview.empty_slot',
                                message: '{position, select, top {Enter HTML to display the banner at the top.} bottom {Enter HTML to display the banner at the bottom.} left {Enter HTML to display the banner in the left sidebar.} other {Enter HTML to display the banner in the right sidebar.}}',
                                values: { position: slot }
                            })}
                        </div>
                    )}
                </div>
            );
        }

        return (
            <button
                type="button"
                aria-pressed="false"
                onClick={() => onPositionChange(slot)}
                className="block min-h-11 w-full text-left hover:opacity-80">
                <div
                    className={cx(
                        'rounded-xl border border-dashed px-3 py-4 text-center text-xs font-semibold',
                        hasSelectedPosition
                            ? 'border-line text-content-hint'
                            : 'border-warning-line bg-warning-surface text-warning'
                    )}>
                    {i18n._({
                        id: 'settings.banners.preview.select_position',
                        message: '{position, select, top {Select top position} bottom {Select bottom position} left {Select left position} other {Select right position}}',
                        values: { position: slot }
                    })}
                </div>
            </button>
        );
    };

    return (
        <div className="relative w-full px-4 md:px-6">
            <div className="post-detail-layout">
                <aside className="post-detail-sidebar">
                    <div className="sticky top-28 space-y-4">
                        {renderSidebarSlot('left')}
                    </div>
                </aside>

                <div className="post-detail-main">
                    <section
                        className="mt-6"
                        aria-label={i18n._({
                            id: 'settings.banners.preview.layout_aria',
                            message: 'Banner placement preview'
                        })}>
                        <article
                            lang={locale}
                            aria-label={i18n._({
                                id: 'settings.banners.preview.example_post_aria',
                                message: 'Example post'
                            })}>
                            <div className={cx('mb-12 transition-opacity sm:mb-16', mutedPostClass)}>
                                <div className="mb-6 flex items-center gap-2">
                                    <span className="inline-flex items-center gap-1.5 rounded-full bg-action px-3 py-1 text-xs font-semibold text-content-inverted">
                                        <Layers3 aria-hidden="true" className="h-3 w-3 opacity-70" />
                                        <Trans id="settings.banners.preview.series">Series</Trans>
                                    </span>
                                    <span className="text-xs font-medium text-content-hint">1 / 5</span>
                                </div>

                                <h2 className="mb-3 break-words text-2xl font-bold leading-tight tracking-tight text-content sm:text-3xl lg:text-4xl">
                                    <Trans id="settings.banners.preview.post_title">
                                        Your post title appears here
                                    </Trans>
                                </h2>
                                <p className="mb-8 text-lg font-medium leading-relaxed text-content-secondary sm:text-xl">
                                    <Trans id="settings.banners.preview.post_subtitle">
                                        Your post subtitle appears here
                                    </Trans>
                                </p>

                                <div className="flex items-center gap-4 border-b border-line-light pb-8 text-sm">
                                    <div className="h-10 w-10 rounded-full bg-line ring-2 ring-line-light" />
                                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                        <span className="font-semibold text-content">
                                            <Trans id="settings.banners.preview.author">Author</Trans>
                                        </span>
                                        <span className="text-content-hint">·</span>
                                        <span className="text-content-secondary">{todayLabel}</span>
                                        <span className="text-content-hint">·</span>
                                        <span className="text-content-secondary">
                                            <Trans id="settings.banners.preview.reading_time">5 min read</Trans>
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className={cx('mb-12 transition-opacity sm:mb-16', mutedPostClass)}>
                                <div className="h-56 w-full rounded-2xl bg-gradient-to-br from-line to-line-strong ring-1 ring-line/5 sm:h-64" />
                            </div>

                            <div className="mb-16">
                                {renderInlineSlot('top')}
                            </div>

                            <div className="mb-16 break-words">
                                {editorPanel}
                            </div>

                            <div className={cx('mb-16 transition-opacity', mutedPostClass)}>
                                <div className="flex flex-wrap gap-2">
                                    <span className="inline-flex items-center rounded-full border border-line-light bg-surface-subtle px-4 py-2 text-sm font-medium text-content-secondary">
                                        <Trans id="settings.banners.preview.tag1">#tag1</Trans>
                                    </span>
                                    <span className="inline-flex items-center rounded-full border border-line-light bg-surface-subtle px-4 py-2 text-sm font-medium text-content-secondary">
                                        <Trans id="settings.banners.preview.tag2">#tag2</Trans>
                                    </span>
                                    <span className="inline-flex items-center rounded-full border border-line-light bg-surface-subtle px-4 py-2 text-sm font-medium text-content-secondary">
                                        <Trans id="settings.banners.preview.tag3">#tag3</Trans>
                                    </span>
                                </div>
                            </div>

                            <div className="mb-16">
                                {renderInlineSlot('bottom')}
                            </div>
                        </article>
                    </section>
                </div>

                <aside className="post-detail-sidebar">
                    <div className="sticky top-28 space-y-4">
                        <div className="text-xs text-content-hint">
                            <Trans id="settings.banners.preview.right_sidebar">
                                TOC / Right sidebar
                            </Trans>
                        </div>
                        {renderSidebarSlot('right')}
                    </div>
                </aside>
            </div>
        </div>
    );
};

export default BannerPreviewFrame;
