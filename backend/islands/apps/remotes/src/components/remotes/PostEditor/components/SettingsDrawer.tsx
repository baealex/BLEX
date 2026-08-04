import { Dialog } from '@blex/ui/dialog';
import { Trans, useLingui } from '@lingui/react/macro';
import { Select } from '@blex/ui/select';
import { IconButton } from '@blex/ui/icon-button';
import { Toggle } from '@blex/ui/toggle';
import {
    CirclePause,
    Clock,
    EyeOff,
    FileText,
    Image,
    Megaphone,
    MessageCircle,
    Search,
    Send,
    SlidersHorizontal,
    Tags,
    Trash2,
    X
} from '@blex/ui/icons';
import { DIM_OVERLAY_DEFAULT, ENTRANCE_DURATION } from '@blex/ui/design-tokens';
import { Input, Button } from '~/components/shared';
import { cx } from '~/lib/classnames';
import type { Series } from '../types';
import SchedulePicker from './SchedulePicker';
import {
    getCoverLayoutOptions,
    getCoverPositionItems,
    getCoverRatioItems,
    getCoverRatioClass,
    supportsCoverImagePosition,
    supportsCoverImageRatio
} from '../utils/coverSettings';

interface SettingsDrawerProps {
    isOpen: boolean;
    onClose: () => void;

    // Form data
    isEdit: boolean;
    isScheduled?: boolean;
    url: string;
    metaDescription: string;
    selectedSeries: Series;
    seriesList: Series[];
    formData: {
        hide: boolean;
        advertise: boolean;
        allowComments: boolean;
        coverLayout: string;
        coverImagePosition: string;
        coverImageRatio: string;
        reservedDate?: string;
    };
    imagePreview: string | null;

    // Handlers
    onUrlChange: (url: string) => void;
    onMetaDescriptionChange: (description: string) => void;
    onSeriesChange: (series: Series) => void;
    onFormDataChange: (field: string, value: boolean | string) => void;
    onDelete?: () => void;
    onCancelSchedule?: () => void;
    onPublishNow?: () => void;
    pendingScheduleAction?: 'cancel' | 'publish-now' | null;
}

interface CoverPreviewProps {
    imagePreview: string | null;
    layout: string;
    imagePosition: string;
    imageRatio: string;
}

const CoverImagePreview = ({
    imagePreview,
    imageRatio,
    className
}: {
    imagePreview: string | null;
    imageRatio: string;
    className?: string;
}) => (
    <div className={cx('overflow-hidden rounded-lg border border-line bg-surface-subtle', getCoverRatioClass(imageRatio), className)}>
        {imagePreview ? (
            <img src={imagePreview} alt="" className="h-full w-full object-cover" />
        ) : (
            <div className="flex h-full w-full items-center justify-center text-content-hint">
                <Image className="h-5 w-5" />
            </div>
        )}
    </div>
);

const CoverTextPreview = ({ inverted = false }: { inverted?: boolean }) => (
    <div className="space-y-2">
        <div className={cx('h-2 w-16 rounded-full', inverted ? 'bg-white/65' : 'bg-line-strong')} />
        <div className={cx('h-3 w-4/5 rounded-full', inverted ? 'bg-white' : 'bg-content')} />
        <div className={cx('h-3 w-2/3 rounded-full', inverted ? 'bg-white/80' : 'bg-content-secondary')} />
        <div className={cx('mt-3 h-2 w-28 rounded-full', inverted ? 'bg-white/55' : 'bg-line-strong')} />
    </div>
);

const CoverStylePreview = ({
    imagePreview,
    layout,
    imagePosition,
    imageRatio
}: CoverPreviewProps) => {
    if (layout === 'overlay') {
        return (
            <div className="relative min-h-36 overflow-hidden rounded-lg border border-line bg-surface-subtle">
                {imagePreview ? (
                    <img src={imagePreview} alt="" className="absolute inset-0 h-full w-full object-cover" />
                ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-content-hint">
                        <Image className="h-6 w-6" />
                    </div>
                )}
                <div className="absolute inset-0 bg-black/45" />
                <div className="absolute inset-x-0 bottom-0 p-4">
                    <CoverTextPreview inverted />
                </div>
            </div>
        );
    }

    if (layout === 'split') {
        const image = (
            <CoverImagePreview
                imagePreview={imagePreview}
                imageRatio={imageRatio}
                className="h-full min-h-28"
            />
        );
        const text = (
            <div className="flex min-h-28 items-center rounded-lg border border-line bg-surface-subtle p-4">
                <CoverTextPreview />
            </div>
        );

        return (
            <div className="grid grid-cols-2 gap-3">
                {imagePosition === 'left' ? image : text}
                {imagePosition === 'left' ? text : image}
            </div>
        );
    }

    if (layout === 'none') {
        return (
            <div className="space-y-3">
                <div className="rounded-lg border border-line bg-surface-subtle p-4">
                    <CoverTextPreview />
                </div>
                <div className="flex items-center gap-3 rounded-lg border border-dashed border-line bg-surface-subtle p-3">
                    <div className="flex h-10 w-14 shrink-0 items-center justify-center overflow-hidden rounded-md bg-surface-elevated text-content-hint">
                        {imagePreview ? (
                            <img src={imagePreview} alt="" className="h-full w-full object-cover" />
                        ) : (
                            <Image className="h-4 w-4" />
                        )}
                    </div>
                    <div className="min-w-0">
                        <div className="h-2 w-20 rounded-full bg-line-strong" />
                        <div className="mt-2 h-2 w-32 rounded-full bg-line" />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            <div className="rounded-lg border border-line bg-surface-subtle p-4">
                <CoverTextPreview />
            </div>
            <CoverImagePreview imagePreview={imagePreview} imageRatio={imageRatio} />
        </div>
    );
};

const SettingsDrawer = ({
    isOpen,
    onClose,
    isEdit,
    isScheduled = false,
    url,
    metaDescription,
    selectedSeries,
    seriesList,
    formData,
    imagePreview,
    onUrlChange,
    onMetaDescriptionChange,
    onSeriesChange,
    onFormDataChange,
    onDelete,
    onCancelSchedule,
    onPublishNow,
    pendingScheduleAction = null
}: SettingsDrawerProps) => {
    const { t } = useLingui();
    const canEditSchedule = !isEdit || isScheduled;
    const coverLayoutOptions = getCoverLayoutOptions();
    const coverPositionItems = getCoverPositionItems();
    const coverRatioItems = getCoverRatioItems();

    return (
        <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <Dialog.Portal>
                {/* Backdrop */}
                <Dialog.Overlay className={`fixed inset-0 ${DIM_OVERLAY_DEFAULT} z-40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0`} />

                {/* Drawer Content */}
                <Dialog.Content
                    className={cx(
                        'fixed inset-y-0 right-0 z-50 w-full sm:w-[480px] bg-surface shadow-2xl flex flex-col focus:outline-none',
                        'data-[state=open]:animate-in data-[state=closed]:animate-out',
                        'data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right',
                        `${ENTRANCE_DURATION} ease-in-out`
                    )}>

                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-5 border-b border-line">
                        <div className="flex items-center gap-3">
                            <SlidersHorizontal className="w-5 h-5 text-content-hint" />
                            <Dialog.Title className="text-lg font-semibold text-content">
                                <Trans id="editor.settings.title">Post settings</Trans>
                            </Dialog.Title>
                        </div>
                        <Dialog.Close asChild>
                            <IconButton
                                aria-label={t({
                                    id: 'common.close',
                                    message: 'Close'
                                })}>
                                <X className="w-5 h-5" />
                            </IconButton>
                        </Dialog.Close>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto px-6 py-6">
                        <div className="space-y-8">
                            {/* Publishing Section */}
                            <div>
                                <h3 className="text-sm font-semibold text-content mb-4 flex items-center gap-2">
                                    <FileText className="w-4 h-4" />
                                    <Trans id="editor.settings.publishing">Publishing</Trans>
                                </h3>
                                <div className="space-y-4">
                                    {canEditSchedule && (
                                        <div className="rounded-xl border border-line bg-surface-subtle p-4">
                                            <div className="mb-3 flex items-start gap-3">
                                                <Clock className="mt-0.5 h-4 w-4 text-content-hint" />
                                                <div>
                                                    <div className="text-sm font-medium text-content">
                                                        {isScheduled
                                                            ? t({
                                                                id: 'editor.schedule.scheduled_time',
                                                                message: 'Scheduled time'
                                                            })
                                                            : t({
                                                                id: 'editor.schedule.publish',
                                                                message: 'Schedule publish'
                                                            })}
                                                    </div>
                                                    <div className="text-xs text-content-secondary">
                                                        {isScheduled
                                                            ? t({
                                                                id: 'editor.schedule.edit_description',
                                                                message: 'Change when this scheduled post will be published'
                                                            })
                                                            : t({
                                                                id: 'editor.schedule.empty_description',
                                                                message: 'Leave this empty to publish immediately'
                                                            })}
                                                    </div>
                                                </div>
                                            </div>
                                            <SchedulePicker
                                                value={formData.reservedDate || ''}
                                                onChange={(nextValue) => onFormDataChange('reservedDate', nextValue)}
                                                allowClear={!isScheduled}
                                            />
                                            {isScheduled && onCancelSchedule && onPublishNow && (
                                                <div className="mt-4 grid grid-cols-2 gap-2 border-t border-line pt-4">
                                                    <Button
                                                        type="button"
                                                        variant="secondary"
                                                        size="md"
                                                        onClick={onCancelSchedule}
                                                        disabled={pendingScheduleAction !== null}
                                                        isLoading={pendingScheduleAction === 'cancel'}
                                                        leftIcon={<CirclePause className="h-4 w-4" />}>
                                                        <Trans id="editor.schedule.cancel">Cancel schedule</Trans>
                                                    </Button>
                                                    <Button
                                                        type="button"
                                                        variant="primary"
                                                        size="md"
                                                        onClick={onPublishNow}
                                                        disabled={pendingScheduleAction !== null}
                                                        isLoading={pendingScheduleAction === 'publish-now'}
                                                        leftIcon={<Send className="h-4 w-4" />}>
                                                        <Trans id="editor.schedule.publish_now">Publish now</Trans>
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    <div className="space-y-1">
                                        <div className="flex items-center justify-between gap-4 py-3">
                                            <div className="flex min-w-0 flex-1 items-center gap-3">
                                                <EyeOff className="w-4 h-4 text-content-hint" />
                                                <div className="min-w-0">
                                                    <div className="text-sm font-medium text-content">
                                                        <Trans id="editor.settings.private">Private</Trans>
                                                    </div>
                                                    <div className="text-xs text-content-secondary">
                                                        {formData.hide
                                                            ? t({
                                                                id: 'editor.settings.private_description',
                                                                message: 'Only you can view this post'
                                                            })
                                                            : t({
                                                                id: 'editor.settings.public_description',
                                                                message: 'Anyone can view this post'
                                                            })}
                                                    </div>
                                                </div>
                                            </div>
                                            <Toggle
                                                checked={formData.hide}
                                                onCheckedChange={(checked) => onFormDataChange('hide', checked)}
                                                aria-label={t({
                                                    id: 'editor.settings.private',
                                                    message: 'Private'
                                                })}
                                            />
                                        </div>

                                        <div className="flex items-center justify-between gap-4 py-3">
                                            <div className="flex min-w-0 flex-1 items-center gap-3">
                                                <MessageCircle className="w-4 h-4 text-content-hint" />
                                                <div className="min-w-0">
                                                    <div className="text-sm font-medium text-content">
                                                        <Trans id="editor.settings.allow_comments">Allow comments</Trans>
                                                    </div>
                                                    <div className="text-xs text-content-secondary">
                                                        {formData.allowComments
                                                            ? t({
                                                                id: 'editor.settings.comments_enabled_description',
                                                                message: 'Readers can add new comments and replies'
                                                            })
                                                            : t({
                                                                id: 'editor.settings.comments_disabled_description',
                                                                message: 'Keep existing comments but prevent new comments and replies'
                                                            })}
                                                    </div>
                                                </div>
                                            </div>
                                            <Toggle
                                                checked={formData.allowComments}
                                                onCheckedChange={(checked) => onFormDataChange('allowComments', checked)}
                                                aria-label={t({
                                                    id: 'editor.settings.allow_comments',
                                                    message: 'Allow comments'
                                                })}
                                            />
                                        </div>

                                        <div className="flex items-center justify-between gap-4 py-3">
                                            <div className="flex min-w-0 flex-1 items-center gap-3">
                                                <Megaphone className="w-4 h-4 text-content-hint" />
                                                <div className="min-w-0">
                                                    <div className="text-sm font-medium text-content">
                                                        <Trans id="editor.settings.promotional">Promotional content</Trans>
                                                    </div>
                                                    <div className="text-xs text-content-secondary">
                                                        <Trans id="editor.settings.promotional_description">
                                                            Mark this post as containing promotion or advertising
                                                        </Trans>
                                                    </div>
                                                </div>
                                            </div>
                                            <Toggle
                                                checked={formData.advertise}
                                                onCheckedChange={(checked) => onFormDataChange('advertise', checked)}
                                                aria-label={t({
                                                    id: 'editor.settings.promotional',
                                                    message: 'Promotional content'
                                                })}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="border-t border-line" />

                            {/* Classification Section */}
                            <div>
                                <h3 className="text-sm font-semibold text-content mb-4 flex items-center gap-2">
                                    <Tags className="w-4 h-4" />
                                    <Trans id="editor.settings.classification">Classification</Trans>
                                </h3>
                                <div>
                                    <label className="block text-sm font-medium text-content mb-2">
                                        <Trans id="editor.settings.series">Series</Trans>
                                    </label>
                                    <Select
                                        value={selectedSeries.id}
                                        onValueChange={(value) => {
                                            if (value === '') {
                                                onSeriesChange({
                                                    id: '',
                                                    name: '',
                                                    url: ''
                                                });
                                            } else {
                                                const series = seriesList.find(s => s.id === value);
                                                if (series) onSeriesChange(series);
                                            }
                                        }}
                                        items={[
                                            {
                                                value: '',
                                                label: t({
                                                    id: 'editor.settings.no_series',
                                                    message: 'No series'
                                                })
                                            },
                                            ...seriesList.map((series) => ({
                                                value: series.id,
                                                label: series.name
                                            }))
                                        ]}
                                        placeholder={t({
                                            id: 'editor.settings.no_series',
                                            message: 'No series'
                                        })}
                                    />
                                </div>
                            </div>

                            <div className="border-t border-line" />

                            {/* Cover Section */}
                            <div>
                                <h3 className="text-sm font-semibold text-content mb-4 flex items-center gap-2">
                                    <Image className="w-4 h-4" />
                                    <Trans id="editor.cover.style">Cover style</Trans>
                                </h3>
                                <div className="space-y-4">
                                    <div className="grid grid-cols-1 gap-2">
                                        {coverLayoutOptions.map((option) => {
                                            const isActive = formData.coverLayout === option.value;
                                            return (
                                                <button
                                                    key={option.value}
                                                    type="button"
                                                    aria-pressed={isActive}
                                                    onClick={() => onFormDataChange('coverLayout', option.value)}
                                                    className={cx(
                                                        'rounded-xl border p-4 text-left transition-all duration-150 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action/30',
                                                        isActive
                                                            ? 'border-action bg-action/10 text-content'
                                                            : 'border-line bg-surface-elevated text-content-secondary hover:border-line-strong hover:bg-surface-subtle'
                                                    )}>
                                                    <span className="block text-sm font-semibold text-content">{option.label}</span>
                                                    <span className="mt-1 block text-xs leading-relaxed text-content-secondary">{option.description}</span>
                                                </button>
                                            );
                                        })}
                                    </div>

                                    <div className="rounded-xl border border-line bg-surface-elevated p-3">
                                        <CoverStylePreview
                                            imagePreview={imagePreview}
                                            layout={formData.coverLayout}
                                            imagePosition={formData.coverImagePosition}
                                            imageRatio={formData.coverImageRatio}
                                        />
                                    </div>

                                    {supportsCoverImagePosition(formData.coverLayout) && (
                                        <div>
                                            <label className="block text-sm font-medium text-content mb-2">
                                                <Trans id="editor.cover.image_position">Image position</Trans>
                                            </label>
                                            <Select
                                                value={formData.coverImagePosition}
                                                onValueChange={(value) => onFormDataChange('coverImagePosition', value)}
                                                items={coverPositionItems}
                                            />
                                        </div>
                                    )}

                                    {supportsCoverImageRatio(formData.coverLayout) && (
                                        <div>
                                            <label className="block text-sm font-medium text-content mb-2">
                                                <Trans id="editor.cover.image_ratio">Image ratio</Trans>
                                            </label>
                                            <Select
                                                value={formData.coverImageRatio}
                                                onValueChange={(value) => onFormDataChange('coverImageRatio', value)}
                                                items={coverRatioItems}
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="border-t border-line" />

                            {/* Search Metadata Section */}
                            <div>
                                <h3 className="text-sm font-semibold text-content mb-4 flex items-center gap-2">
                                    <Search className="w-4 h-4" />
                                    <Trans id="editor.settings.search_and_sharing">Search and sharing</Trans>
                                </h3>
                                <div className="space-y-4">
                                    {!isEdit && (
                                        <div>
                                            <Input
                                                id="drawer-url"
                                                label={t({
                                                    id: 'editor.fields.url',
                                                    message: 'URL'
                                                })}
                                                value={url}
                                                onChange={(e) => onUrlChange(e.target.value)}
                                                placeholder={t({
                                                    id: 'editor.fields.url_placeholder',
                                                    message: 'post-url'
                                                })}
                                            />
                                            <p className="text-xs text-content-hint mt-2">
                                                <Trans id="editor.fields.url_collision_hint">
                                                    Addresses already in use are adjusted automatically to avoid conflicts
                                                </Trans>
                                            </p>
                                        </div>
                                    )}

                                    <div>
                                        <Input
                                            id="drawer-meta"
                                            label={t({
                                                id: 'editor.fields.meta_description',
                                                message: 'Search and sharing description'
                                            })}
                                            multiline
                                            rows={4}
                                            value={metaDescription}
                                            onChange={(e) => onMetaDescriptionChange(e.target.value)}
                                            placeholder={t({
                                                id: 'editor.fields.meta_description_placeholder',
                                                message: 'Describe this post'
                                            })}
                                            maxLength={150}
                                        />
                                        <div className="flex items-center justify-between mt-2">
                                            <p className="text-xs text-content-hint">
                                                <Trans id="editor.fields.meta_description_hint">
                                                    Used in search results and shared previews
                                                </Trans>
                                            </p>
                                            <p className={`text-xs font-medium ${metaDescription.length > 140 ? 'text-danger' : 'text-content-hint'}`}>
                                                {metaDescription.length}/150
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Delete Section - Edit mode only */}
                            {isEdit && onDelete && (
                                <>
                                    <div className="border-t border-line" />
                                    <div>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={onDelete}
                                            className="!text-danger hover:!text-danger hover:!bg-danger-surface !px-0"
                                            leftIcon={<Trash2 className="w-4 h-4" />}>
                                            <Trans id="editor.actions.delete_post">Delete post</Trans>
                                        </Button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="px-6 py-4 border-t border-line bg-surface-subtle">
                        <Button
                            type="button"
                            onClick={onClose}
                            variant="primary"
                            size="md"
                            fullWidth>
                            <Trans id="common.done">Done</Trans>
                        </Button>
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
};

export default SettingsDrawer;
