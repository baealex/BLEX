import React, { useRef } from 'react';
import { Trans, useLingui } from '@lingui/react/macro';
import { Button } from '@blex/ui/button';
import { IconButton } from '@blex/ui/icon-button';
import { Image, X } from '@blex/ui/icons';
import { cx } from '~/lib/classnames';
import { getCoverRatioClass } from '../utils/coverSettings';

interface PostCoverEditorData {
    title: string;
    subtitle: string;
    coverLayout: string;
    coverImagePosition: string;
    coverImageRatio: string;
}

interface PostCoverEditorProps {
    formData: PostCoverEditorData;
    imagePreview: string | null;
    onTitleChange: (title: string) => void;
    onSubtitleChange: (subtitle: string) => void;
    onImageUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
    onRemoveImage: () => void;
}

interface CoverImageSlotProps {
    imagePreview: string | null;
    imageRatio: string;
    compact?: boolean;
    onOpenFilePicker: () => void;
    onRemoveImage: () => void;
}

const TitleInputs = ({
    title,
    subtitle,
    inverted,
    onTitleChange,
    onSubtitleChange
}: {
    title: string;
    subtitle: string;
    inverted?: boolean;
    onTitleChange: (title: string) => void;
    onSubtitleChange: (subtitle: string) => void;
}) => {
    const { t } = useLingui();

    return (
        <div>
            <label htmlFor="title" className="sr-only">
                <Trans id="editor.fields.title">Title</Trans>
            </label>
            <input
                type="text"
                id="title"
                name="title"
                value={title}
                onChange={(event) => onTitleChange(event.target.value)}
                maxLength={65}
                className={cx(
                    'w-full border-0 px-0 py-0 text-2xl font-bold leading-tight text-content placeholder-content-hint focus:ring-0 sm:text-3xl lg:text-4xl',
                    inverted && 'bg-transparent text-white placeholder:text-white/65'
                )}
                placeholder={t({
                    id: 'editor.fields.title_placeholder',
                    message: 'Enter a title'
                })}
                required
            />
            {title.length > 50 && (
                <p className={cx('mt-1 text-xs', title.length >= 65 ? 'text-danger' : inverted ? 'text-white/70' : 'text-content-hint')}>
                    {title.length}/65
                </p>
            )}
            <label htmlFor="subtitle" className="sr-only">
                <Trans id="editor.fields.subtitle">Subtitle</Trans>
            </label>
            <input
                type="text"
                id="subtitle"
                name="subtitle"
                value={subtitle}
                onChange={(event) => onSubtitleChange(event.target.value)}
                maxLength={120}
                aria-describedby={subtitle.length > 100 ? 'subtitle-character-count' : undefined}
                className={cx(
                    'mt-2 w-full border-0 px-0 py-0 text-lg leading-tight text-content-secondary placeholder-content-hint focus:ring-0 sm:text-xl',
                    inverted && 'bg-transparent text-white/85 placeholder:text-white/55'
                )}
                placeholder={t({
                    id: 'editor.fields.subtitle_placeholder',
                    message: 'Subtitle (optional)'
                })}
            />
            {subtitle.length > 100 && (
                <p
                    id="subtitle-character-count"
                    aria-live="polite"
                    className={cx(
                        'mt-1 text-xs',
                        subtitle.length >= 120
                            ? 'text-danger'
                            : inverted ? 'text-white/70' : 'text-content-hint'
                    )}>
                    {subtitle.length}/120
                </p>
            )}
        </div>
    );
};

const CoverImageSlot = ({
    imagePreview,
    imageRatio,
    compact = false,
    onOpenFilePicker,
    onRemoveImage
}: CoverImageSlotProps) => {
    const { t } = useLingui();

    if (compact) {
        return (
            <div className="mt-6 flex items-center justify-between gap-4 rounded-lg border border-dashed border-line bg-surface-subtle p-3">
                <button
                    type="button"
                    onClick={onOpenFilePicker}
                    className="flex min-w-0 items-center gap-3 text-left">
                    <span className="flex h-12 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md bg-surface-elevated text-content-hint ring-1 ring-line-light">
                        {imagePreview ? (
                            <img src={imagePreview} alt="" className="h-full w-full object-cover" />
                        ) : (
                            <Image className="h-5 w-5" />
                        )}
                    </span>
                    <span className="min-w-0">
                        <span className="block text-sm font-medium text-content">
                            <Trans id="editor.cover.image">Cover image</Trans>
                        </span>
                        <span className="block truncate text-xs text-content-secondary">
                            {imagePreview ? (
                                <Trans id="editor.cover.hidden_image_description">
                                    Used in shares and listings without appearing at the top of the post
                                </Trans>
                            ) : (
                                <Trans id="editor.cover.hidden_image_empty">
                                    Add an image for shares and listings
                                </Trans>
                            )}
                        </span>
                    </span>
                </button>
                <div className="flex shrink-0 items-center gap-1">
                    <Button type="button" variant="ghost" size="sm" onClick={onOpenFilePicker}>
                        {imagePreview ? (
                            <Trans id="common.replace">Replace</Trans>
                        ) : (
                            <Trans id="common.add">Add</Trans>
                        )}
                    </Button>
                    {imagePreview && (
                        <IconButton
                            type="button"
                            size="sm"
                            rounded="full"
                            onClick={onRemoveImage}
                            aria-label={t({
                                id: 'editor.cover.remove_share_image',
                                message: 'Remove sharing image'
                            })}>
                            <X className="h-4 w-4" />
                        </IconButton>
                    )}
                </div>
            </div>
        );
    }

    if (!imagePreview) {
        return (
            <button
                type="button"
                onClick={onOpenFilePicker}
                className={cx(
                    'flex w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-line bg-surface-subtle px-4 py-12 text-center transition-colors duration-150 hover:border-line-strong hover:bg-surface-elevated',
                    getCoverRatioClass(imageRatio)
                )}>
                <Image className="mb-3 h-10 w-10 text-content-hint" />
                <span className="text-sm text-content-secondary">
                    <Trans id="editor.cover.add_image">Add cover image</Trans>
                </span>
                <span className="mt-1 text-xs text-content-hint">
                    <Trans id="editor.cover.click_to_upload">Click to upload</Trans>
                </span>
            </button>
        );
    }

    if (imageRatio === 'auto') {
        return (
            <div className="group relative">
                <img src={imagePreview} alt="" className="w-full rounded-2xl ring-1 ring-line/60" />
                <ImageActions onOpenFilePicker={onOpenFilePicker} onRemoveImage={onRemoveImage} />
            </div>
        );
    }

    return (
        <div className={cx('group relative overflow-hidden rounded-2xl ring-1 ring-line/60', getCoverRatioClass(imageRatio))}>
            <img src={imagePreview} alt="" className="h-full w-full object-cover" />
            <ImageActions onOpenFilePicker={onOpenFilePicker} onRemoveImage={onRemoveImage} />
        </div>
    );
};

const ImageActions = ({
    onOpenFilePicker,
    onRemoveImage
}: {
    onOpenFilePicker: () => void;
    onRemoveImage: () => void;
}) => {
    const { t } = useLingui();

    return (
        <div className="absolute right-3 top-3 flex gap-2 sm:opacity-0 sm:transition-opacity sm:duration-150 sm:group-hover:opacity-100">
            <Button type="button" variant="secondary" size="sm" onClick={onOpenFilePicker}>
                <Trans id="common.replace">Replace</Trans>
            </Button>
            <IconButton
                type="button"
                size="sm"
                rounded="full"
                onClick={onRemoveImage}
                aria-label={t({
                    id: 'editor.cover.remove_image',
                    message: 'Remove cover image'
                })}>
                <X className="h-4 w-4" />
            </IconButton>
        </div>
    );
};

const PostCoverEditor = ({
    formData,
    imagePreview,
    onTitleChange,
    onSubtitleChange,
    onImageUpload,
    onRemoveImage
}: PostCoverEditorProps) => {
    const imageInputRef = useRef<HTMLInputElement>(null);

    const openFilePicker = () => {
        imageInputRef.current?.click();
    };

    const handleRemoveImage = () => {
        onRemoveImage();
        if (imageInputRef.current) {
            imageInputRef.current.value = '';
        }
    };

    const imageInput = (
        <input
            ref={imageInputRef}
            type="file"
            id="image"
            name="image"
            className="hidden"
            accept="image/*"
            onChange={onImageUpload}
        />
    );

    if (formData.coverLayout === 'overlay') {
        return (
            <section className="mb-8">
                {imageInput}
                <div className="relative isolate flex min-h-[360px] items-end overflow-hidden rounded-2xl bg-content p-6 sm:p-8">
                    {imagePreview && (
                        <img src={imagePreview} alt="" className="absolute inset-0 -z-10 h-full w-full object-cover" />
                    )}
                    <div className="absolute inset-0 -z-10 bg-black/45" />
                    <div className="w-full max-w-3xl">
                        <TitleInputs
                            title={formData.title}
                            subtitle={formData.subtitle}
                            inverted
                            onTitleChange={onTitleChange}
                            onSubtitleChange={onSubtitleChange}
                        />
                        <div className="mt-6 flex flex-wrap gap-2">
                            <Button type="button" variant="secondary" size="sm" onClick={openFilePicker}>
                                {imagePreview ? (
                                    <Trans id="editor.cover.replace_image">Replace cover image</Trans>
                                ) : (
                                    <Trans id="editor.cover.add_image">Add cover image</Trans>
                                )}
                            </Button>
                            {imagePreview && (
                                <Button type="button" variant="secondary" size="sm" onClick={handleRemoveImage}>
                                    <Trans id="common.remove">Remove</Trans>
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            </section>
        );
    }

    if (formData.coverLayout === 'split') {
        const textPanel = (
            <div className="flex min-h-56 items-center rounded-2xl bg-surface p-0">
                <TitleInputs
                    title={formData.title}
                    subtitle={formData.subtitle}
                    onTitleChange={onTitleChange}
                    onSubtitleChange={onSubtitleChange}
                />
            </div>
        );
        const imagePanel = (
            <CoverImageSlot
                imagePreview={imagePreview}
                imageRatio={formData.coverImageRatio}
                onOpenFilePicker={openFilePicker}
                onRemoveImage={handleRemoveImage}
            />
        );

        return (
            <section className="mb-8">
                {imageInput}
                <div className="grid gap-6 lg:grid-cols-2 lg:items-center">
                    {formData.coverImagePosition === 'left' ? imagePanel : textPanel}
                    {formData.coverImagePosition === 'left' ? textPanel : imagePanel}
                </div>
            </section>
        );
    }

    return (
        <section className="mb-8">
            {imageInput}
            <div className="mb-8">
                <TitleInputs
                    title={formData.title}
                    subtitle={formData.subtitle}
                    onTitleChange={onTitleChange}
                    onSubtitleChange={onSubtitleChange}
                />
            </div>
            {formData.coverLayout === 'none' ? (
                <CoverImageSlot
                    imagePreview={imagePreview}
                    imageRatio={formData.coverImageRatio}
                    compact
                    onOpenFilePicker={openFilePicker}
                    onRemoveImage={handleRemoveImage}
                />
            ) : (
                <CoverImageSlot
                    imagePreview={imagePreview}
                    imageRatio={formData.coverImageRatio}
                    onOpenFilePicker={openFilePicker}
                    onRemoveImage={handleRemoveImage}
                />
            )}
        </section>
    );
};

export default PostCoverEditor;
