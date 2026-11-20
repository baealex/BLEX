import { useState } from 'react';
import { Trans, useLingui } from '@lingui/react/macro';
import { Dialog } from '@blex/ui/dialog';
import { ArrowLeft } from '@blex/ui/icons';
import type { BannerPosition, BannerType } from './bannerI18n';
import ScaledBannerHtml from './ScaledBannerHtml';

interface BannerPreviewContentProps {
    html?: string;
    error?: string;
    customHtml: boolean;
    className?: string;
    /** Draw the banner at this slot width and scale it to fit, instead of squeezing it into the frame. */
    slotWidth?: number;
}

interface BannerPreviewDialogProps extends BannerPreviewContentProps {
    onClose: () => void;
    onReturnFocus: () => void;
    position: BannerPosition;
    bannerType: BannerType;
}

/** Frames narrower than this are on a phone, where readers also see the banner at its natural size. */
const SMALL_SCREEN_FRAME = 480;

const CustomHtmlPreview = ({ html }: { html: string }) => {
    const { t } = useLingui();
    const [height, setHeight] = useState(100);
    const theme = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
    const styles = Array.from(document.head.querySelectorAll('link[rel="stylesheet"], style[data-vite-dev-id]'))
        .map((style) => style.outerHTML)
        .join('');

    return (
        <iframe
            title={t({
                id: 'settings.banners.editor.live_preview',
                message: 'Banner preview'
            })}
            sandbox="allow-same-origin"
            srcDoc={`<!doctype html><html data-theme="${theme}"><head><meta charset="utf-8">${styles}</head><body>${html}</body></html>`}
            style={{ height }}
            className="block w-full border-0"
            onLoad={({ currentTarget }) => setHeight(currentTarget.contentDocument?.body?.scrollHeight || 100)}
        />
    );
};

export const BannerPreviewContent = ({
    html,
    error,
    customHtml,
    className,
    slotWidth
}: BannerPreviewContentProps) => {
    if (error || !html?.trim()) {
        return (
            <p role="status" className="p-2 text-sm text-content-secondary">
                {error ?? (html === undefined
                    ? <Trans id="common.loading">Loading</Trans>
                    : <Trans id="settings.banners.preview.empty">Add content to see your banner here.</Trans>)}
            </p>
        );
    }

    return (
        <div inert className={className}>
            {customHtml && <CustomHtmlPreview html={html} />}
            {!customHtml && slotWidth && (
                <ScaledBannerHtml html={html} slotWidth={slotWidth} naturalBelow={SMALL_SCREEN_FRAME} />
            )}
            {!customHtml && !slotWidth && <div dangerouslySetInnerHTML={{ __html: html }} />}
        </div>
    );
};

const SkeletonLine = ({ className }: { className: string }) => (
    <div className={`rounded-full bg-surface-subtle ${className}`} />
);

const BannerPreviewDialog = ({
    onClose,
    onReturnFocus,
    html,
    error,
    customHtml,
    position,
    bannerType
}: BannerPreviewDialogProps) => {
    const { t } = useLingui();
    const banner = (
        <div
            ref={(node) => node?.scrollIntoView({ block: 'center' })}>
            <BannerPreviewContent html={html} error={error} customHtml={customHtml} />
        </div>
    );
    const slot = (target: BannerPosition) => (position === target ? banner : null);

    return (
        <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 z-[70] dim-overlay-default" />
                <Dialog.Content
                    onCloseAutoFocus={(event) => {
                        event.preventDefault();
                        onReturnFocus();
                    }}
                    className="fixed inset-0 z-[80] flex flex-col bg-surface focus:outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 duration-150">
                    <header className="flex h-14 flex-shrink-0 items-center justify-between gap-3 border-b border-line px-4 md:px-6">
                        <button
                            type="button"
                            className="flex min-h-11 items-center gap-2 text-sm text-content-secondary transition-colors hover:text-content"
                            onClick={onClose}>
                            <ArrowLeft aria-hidden="true" className="h-4 w-4" />
                            <Trans id="settings.banners.preview.back_to_editor">Back to editing</Trans>
                        </button>
                        <Dialog.Title className="text-sm font-semibold text-content">
                            {t({
                                id: 'settings.banners.preview.heading',
                                message: 'Post preview'
                            })}
                        </Dialog.Title>
                        <Dialog.Description className="sr-only">
                            {t({
                                id: 'settings.banners.preview.description',
                                message: 'The banner placed on a sample post.'
                            })}
                        </Dialog.Description>
                    </header>

                    <div className="min-h-0 flex-1 overflow-y-auto pb-16">
                        {bannerType === 'sidebar' && (
                            <p className="border-b border-line-light px-4 py-3 text-center text-xs text-content-secondary xl:hidden">
                                {t({
                                    id: 'settings.banners.preview.sidebar_hidden',
                                    message: 'Side banners appear on screens 1280px and wider. Widen the window to see it.'
                                })}
                            </p>
                        )}

                        <div className="post-detail-body px-4 md:px-6">
                            <div className="post-detail-layout">
                                <aside className="post-detail-sidebar">
                                    <div className="sticky top-4 mt-6 space-y-4">
                                        {slot('left')}
                                    </div>
                                </aside>

                                <div className="post-detail-main">
                                    <article className="mt-6">
                                        <h2 className="mb-6 text-3xl font-bold tracking-tight text-content sm:text-4xl">
                                            <Trans id="settings.banners.preview.sample_title">Sample post</Trans>
                                        </h2>
                                        <div aria-hidden="true">
                                            <div className="mb-12 flex items-center gap-3 border-b border-line-light pb-8">
                                                <div className="h-10 w-10 rounded-full bg-surface-subtle" />
                                                <SkeletonLine className="h-4 w-48" />
                                            </div>
                                            <div className="mb-12 h-56 w-full rounded-2xl bg-surface-subtle sm:h-64" />
                                        </div>

                                        {position === 'top' && <div className="mb-16">{banner}</div>}

                                        <div
                                            itemProp="articleBody"
                                            className="prose prose-lg blog-post-content mb-16 max-w-none break-words">
                                            <p><Trans id="settings.banners.preview.sample_body">This is the body of the post. A banner can appear above or below the text, or beside it on a wide screen.</Trans></p>
                                        </div>

                                        <div aria-hidden="true" className="mb-16 flex gap-2">
                                            <SkeletonLine className="h-9 w-20" />
                                            <SkeletonLine className="h-9 w-24" />
                                            <SkeletonLine className="h-9 w-16" />
                                        </div>

                                        {position === 'bottom' && <div className="mb-16">{banner}</div>}
                                    </article>
                                </div>

                                <aside className="post-detail-sidebar">
                                    <div className="sticky top-4 mt-6 space-y-4">
                                        <div aria-hidden="true" className="space-y-2">
                                            <SkeletonLine className="h-3 w-24" />
                                            <SkeletonLine className="h-3 w-32" />
                                            <SkeletonLine className="h-3 w-28" />
                                        </div>
                                        {slot('right')}
                                    </div>
                                </aside>
                            </div>
                        </div>
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
};

export default BannerPreviewDialog;
