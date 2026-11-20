import { useLingui } from '@lingui/react/macro';
import { Dialog } from '@blex/ui/dialog';
import { IconButton } from '@blex/ui/icon-button';
import { X } from '@blex/ui/icons';
import { DIM_OVERLAY_DEFAULT } from '@blex/ui/design-tokens';
import type { BannerPosition, BannerType } from './bannerI18n';

interface BannerPreviewDialogProps {
    isOpen: boolean;
    onClose: () => void;
    /** Server-rendered banner HTML, identical to what post pages display. */
    html: string;
    position: BannerPosition;
    bannerType: BannerType;
}

const SkeletonLine = ({ className }: { className: string }) => (
    <div className={`rounded-full bg-surface-subtle ${className}`} />
);

/** A post page made of placeholders so the banner is the only real content on screen. */
const BannerPreviewDialog = ({
    isOpen,
    onClose,
    html,
    position,
    bannerType
}: BannerPreviewDialogProps) => {
    const { t } = useLingui();
    const banner = (
        <div
            ref={(node) => node?.scrollIntoView({ block: 'center' })}
            dangerouslySetInnerHTML={{ __html: html }}
        />
    );
    const slot = (target: BannerPosition) => (position === target ? banner : null);

    return (
        <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <Dialog.Portal>
                <Dialog.Overlay className={`fixed inset-0 ${DIM_OVERLAY_DEFAULT} z-[70]`} />
                <Dialog.Content
                    className="fixed inset-0 z-[80] flex flex-col bg-surface focus:outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 duration-150">
                    <header className="flex h-14 flex-shrink-0 items-center justify-between border-b border-line px-4 md:px-6">
                        <Dialog.Title className="text-sm font-semibold text-content">
                            {t({
                                id: 'settings.banners.preview.heading',
                                message: 'Preview'
                            })}
                        </Dialog.Title>
                        <Dialog.Description className="sr-only">
                            {t({
                                id: 'settings.banners.preview.description',
                                message: 'The banner placed on a sample post.'
                            })}
                        </Dialog.Description>
                        <IconButton
                            size="sm"
                            aria-label={t({
                                id: 'common.close',
                                message: 'Close'
                            })}
                            onClick={onClose}>
                            <X className="h-5 w-5" />
                        </IconButton>
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
                                    <div className="sticky top-8 mt-6 space-y-4">
                                        {slot('left')}
                                    </div>
                                </aside>

                                <div className="post-detail-main">
                                    <div className="mt-6">
                                        <div aria-hidden="true">
                                            <SkeletonLine className="mb-5 h-6 w-24" />
                                            <SkeletonLine className="mb-3 h-9 w-4/5" />
                                            <SkeletonLine className="mb-8 h-5 w-1/2" />
                                            <div className="mb-12 flex items-center gap-3 border-b border-line-light pb-8">
                                                <div className="h-10 w-10 rounded-full bg-surface-subtle" />
                                                <SkeletonLine className="h-4 w-48" />
                                            </div>
                                            <div className="mb-12 h-56 w-full rounded-2xl bg-surface-subtle sm:h-64" />
                                        </div>

                                        {position === 'top' && <div className="mb-16">{banner}</div>}

                                        <div aria-hidden="true" className="mb-16 space-y-3">
                                            <SkeletonLine className="h-4 w-full" />
                                            <SkeletonLine className="h-4 w-11/12" />
                                            <SkeletonLine className="h-4 w-full" />
                                            <SkeletonLine className="h-4 w-3/4" />
                                            <div className="h-4" />
                                            <SkeletonLine className="h-4 w-full" />
                                            <SkeletonLine className="h-4 w-5/6" />
                                            <SkeletonLine className="h-4 w-2/3" />
                                        </div>

                                        <div aria-hidden="true" className="mb-16 flex gap-2">
                                            <SkeletonLine className="h-9 w-20" />
                                            <SkeletonLine className="h-9 w-24" />
                                            <SkeletonLine className="h-9 w-16" />
                                        </div>

                                        {position === 'bottom' && <div className="mb-16">{banner}</div>}
                                    </div>
                                </div>

                                <aside className="post-detail-sidebar">
                                    <div className="sticky top-8 mt-6 space-y-4">
                                        <div aria-hidden="true" className="space-y-2">
                                            <SkeletonLine className="h-3 w-24" />
                                            <SkeletonLine className="h-3 w-36" />
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
