
import {
    useState,
    useEffect,
    useMemo,
    useRef,
    useCallback
} from 'react';
import type { MouseEvent } from 'react';
import { Trans, useLingui } from '@lingui/react/macro';
import { toast } from '~/utils/toast';
import { useConfirm } from '~/hooks/useConfirm';
import PostEditorWrapper from './PostEditorWrapper';
import PostActions from './components/PostActions';
import PostForm from './components/PostForm';
import DraftsPanel from './components/DraftsPanel';
import SettingsDrawer from './components/SettingsDrawer';
import PostPreviewDialog from './components/PostPreviewDialog';
import PublishChecklist from './components/PublishChecklist';
import ScheduleStatusNotice from './components/ScheduleStatusNotice';
import { useAutoSave } from './hooks/useAutoSave';
import { useImageUpload } from './hooks/useImageUpload';
import { useFormSubmit } from './hooks/useFormSubmit';
import { Info } from '@blex/ui/icons';
import { startFirstPublishTour as startFirstPublishTourDriver } from './utils/firstPublishTour';
import { getPublishChecklist } from './utils/publishChecklist';
import { toDateTimeLocalValue } from './utils/scheduleDate';
import { getSeries } from '~/lib/api/settings';
import { getDraft } from '~/lib/api/posts';
import { normalizeLocale } from '~/i18n/locale';
import { api } from '~/components/shared';
import type { Series } from './types';

interface NewPostEditorProps {
    draftUrl?: string;
    showFirstPublishGuide?: boolean;
}

const normalizeUrlInput = (value: string) => {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9가-힣\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .substring(0, 50);
};

const normalizeUrlForSubmit = (value: string) => {
    return normalizeUrlInput(value).replace(/^-+|-+$/g, '');
};

const generateUrlFromTitle = (title: string) => {
    return normalizeUrlForSubmit(title);
};

const NewPostEditor = ({
    draftUrl,
    showFirstPublishGuide = false
}: NewPostEditorProps) => {
    const { i18n, t } = useLingui();
    const { confirm } = useConfirm();
    const [isLoading, setIsLoading] = useState(true);
    const [seriesList, setSeriesList] = useState<Series[]>([]);
    const [isDraftsPanelOpen, setIsDraftsPanelOpen] = useState(false);
    const [isSettingsDrawerOpen, setIsSettingsDrawerOpen] = useState(false);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [isPreparingPreview, setIsPreparingPreview] = useState(false);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [isUrlAutoSync, setIsUrlAutoSync] = useState(true);
    const [currentDraftUrl, setCurrentDraftUrl] = useState(draftUrl);
    const [showPublishChecklist, setShowPublishChecklist] = useState(false);
    const [isEditorMediaUploading, setIsEditorMediaUploading] = useState(false);
    const previewTriggerRef = useRef<HTMLButtonElement | null>(null);

    const [formData, setFormData] = useState({
        title: '',
        subtitle: '',
        url: '',
        content: '',
        metaDescription: '',
        hide: false,
        advertise: false,
        allowComments: true,
        coverLayout: 'default',
        coverImagePosition: 'right',
        coverImageRatio: 'auto',
        reservedDate: ''
    });

    const [tags, setTags] = useState<string[]>([]);
    const [selectedSeries, setSelectedSeries] = useState<Series>({
        id: '',
        name: '',
        url: ''
    });

    type DirtySnapshot = {
        title: string;
        subtitle: string;
        url: string;
        content: string;
        metaDescription: string;
        hide: boolean;
        advertise: boolean;
        allowComments: boolean;
        coverLayout: string;
        coverImagePosition: string;
        coverImageRatio: string;
        reservedDate: string;
        tags: string[];
        seriesUrl: string;
        imagePreview: string;
        imageFilePending: boolean;
        imageDeleted: boolean;
    };

    // Track initial state for dirty check
    const initialDataRef = useRef<DirtySnapshot | null>(null);
    const isIntentionalSubmitRef = useRef(false);
    const firstPublishGuideButtonRef = useRef<HTMLButtonElement>(null);

    // Custom hooks
    const {
        imagePreview,
        imageFile,
        imageDeleted,
        handleImageUpload,
        handleRemoveImage,
        setImagePreviewUrl,
        markImageSaved
    } = useImageUpload();

    const buildDirtySnapshot = useCallback((): DirtySnapshot => ({
        title: formData.title,
        subtitle: formData.subtitle,
        url: formData.url,
        content: formData.content,
        metaDescription: formData.metaDescription,
        hide: formData.hide,
        advertise: formData.advertise,
        allowComments: formData.allowComments,
        coverLayout: formData.coverLayout,
        coverImagePosition: formData.coverImagePosition,
        coverImageRatio: formData.coverImageRatio,
        reservedDate: formData.reservedDate,
        tags,
        seriesUrl: selectedSeries.url || '',
        imagePreview: imagePreview || '',
        imageFilePending: Boolean(imageFile),
        imageDeleted
    }), [formData, tags, selectedSeries.url, imagePreview, imageFile, imageDeleted]);

    const handleEditorImageUpload = async (file: File) => {
        const { data } = await api.uploadImage(file).catch(() => {
            throw new Error(t({
                id: 'editor.media.error.upload',
                message: 'File upload failed.'
            }));
        });

        if (data.status === 'DONE') {
            return data.body.url;
        }

        throw new Error(data.errorMessage || t({
            id: 'editor.media.error.upload',
            message: 'File upload failed.'
        }));
    };

    const handleAutoSaveSuccess = (url?: string) => {
        if (url) {
            if (url !== currentDraftUrl) {
                setCurrentDraftUrl(url);
            }

            const newUrl = new URL(window.location.href);
            newUrl.searchParams.set('draft', url);
            window.history.replaceState({}, '', newUrl.toString());
        }

        initialDataRef.current = {
            ...buildDirtySnapshot(),
            imageFilePending: false,
            imageDeleted: false
        };
        markImageSaved();
    };

    const handleAutoSaveError = () => {
        // Auto-save failure is not critical, no notification needed
    };

    const sanitizedUrlForSubmit = normalizeUrlForSubmit(formData.url);

    const autoSaveData = {
        title: formData.title,
        content: formData.content,
        tags: tags.join(','),
        subtitle: formData.subtitle,
        description: formData.metaDescription,
        seriesUrl: selectedSeries.url || undefined,
        customUrl: sanitizedUrlForSubmit || undefined,
        coverLayout: formData.coverLayout,
        coverImagePosition: formData.coverImagePosition,
        coverImageRatio: formData.coverImageRatio,
        hide: formData.hide,
        advertise: formData.advertise,
        blockComment: !formData.allowComments,
        reservedDate: formData.reservedDate,
        imageFile,
        imageDeleted
    };

    const autoSaveOptions = {
        enabled: !isLoading && !isEditorMediaUploading,
        draftUrl: currentDraftUrl,
        onSuccess: handleAutoSaveSuccess,
        onError: handleAutoSaveError
    };

    const {
        lastSaved,
        isSaving,
        hasSaveError,
        hasPendingChanges,
        autoSaveCountdown,
        manualSave
    } = useAutoSave(autoSaveData, autoSaveOptions);

    const handleSubmitError = () => {
        // Error notification is handled inside useFormSubmit
    };

    const submitOptions = {
        draftUrl: currentDraftUrl,
        onBeforeSubmit: () => {
            isIntentionalSubmitRef.current = true;
        },
        onSubmitError: handleSubmitError
    };

    const { formRef, isSubmitting, submitForm } = useFormSubmit(submitOptions);

    const publishChecklist = useMemo(() => getPublishChecklist(
        {
            title: formData.title,
            content: formData.content,
            description: formData.metaDescription,
            tags,
            hasCoverImage: Boolean(imagePreview),
            isHidden: formData.hide,
            scheduledAt: formData.reservedDate || undefined
        },
        normalizeLocale(i18n.locale)
    ), [formData.title, formData.content, formData.metaDescription, formData.hide, formData.reservedDate, tags, imagePreview, i18n.locale]);

    const shouldShowFirstPublishGuide = !isLoading && showFirstPublishGuide;

    // Fetch series list and draft data if draftUrl exists
    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                // Fetch series list
                const { data: seriesResponse } = await getSeries();
                let mappedSeries: Series[] = [];
                if (seriesResponse.status === 'DONE') {
                    mappedSeries = (seriesResponse.body.series || []).map(s => ({
                        id: String(s.id),
                        name: s.title,
                        url: s.url
                    }));
                    setSeriesList(mappedSeries);
                }

                // Fetch draft data if draftUrl exists
                if (draftUrl) {
                    const { data: draftResponse } = await getDraft(draftUrl);
                    if (draftResponse.status === 'DONE' && draftResponse.body) {
                        const draftData = draftResponse.body;
                        const newTitle = draftData.title || '';
                        const newContent = draftData.contentHtml || draftData.rawContent || '';
                        const newTags = draftData.tags ? draftData.tags.split(',').filter(Boolean) : [];
                        const newSubtitle = draftData.subtitle || '';
                        const newDescription = draftData.description || '';
                        const newReservedDate = toDateTimeLocalValue(draftData.reservedDate);

                        setFormData(prev => ({
                            ...prev,
                            title: newTitle,
                            subtitle: newSubtitle,
                            url: draftData.url || '',
                            content: newContent,
                            metaDescription: newDescription,
                            coverLayout: draftData.coverLayout || 'default',
                            coverImagePosition: draftData.coverImagePosition || 'right',
                            coverImageRatio: draftData.coverImageRatio || 'auto',
                            hide: draftData.isHide ?? false,
                            advertise: draftData.isAdvertise ?? false,
                            allowComments: !(draftData.blockComment ?? false),
                            reservedDate: newReservedDate
                        }));
                        setCurrentDraftUrl(draftData.url || draftUrl);
                        setIsUrlAutoSync(
                            !draftData.url || draftData.url === generateUrlFromTitle(newTitle)
                        );
                        setTags(newTags);

                        // Restore series
                        if (draftData.series) {
                            const matchingSeries = mappedSeries.find(s => s.url === draftData.series?.url);
                            if (matchingSeries) {
                                setSelectedSeries(matchingSeries);
                            }
                        }

                        // Restore image
                        if (draftData.image) {
                            setImagePreviewUrl(draftData.image);
                        }

                        // Store initial state after React state updates settle below.
                    }
                }
            } catch {
                toast.error(draftUrl
                    ? t({
                        id: 'editor.error.load_draft',
                        message: 'Could not load the draft.'
                    })
                    : t({
                        id: 'editor.error.load_series',
                        message: 'Could not load the series list.'
                    }));
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [draftUrl, setImagePreviewUrl, t]);

    useEffect(() => {
        if (!isLoading && !initialDataRef.current) {
            initialDataRef.current = buildDirtySnapshot();
        }
    }, [isLoading, buildDirtySnapshot]);

    // Check if form has unsaved changes
    const hasUnsavedChanges = () => {
        const initial = initialDataRef.current;
        if (!initial) return false;

        const current = buildDirtySnapshot();
        return JSON.stringify(current) !== JSON.stringify(initial);
    };

    // Warn on page unload if there are unsaved changes
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (isIntentionalSubmitRef.current) {
                return;
            }

            if (hasUnsavedChanges()) {
                e.preventDefault();
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    });

    // Handle draft selection
    const handleSelectDraft = async (url: string) => {
        if (url === currentDraftUrl) {
            // Already on this post
            setIsDraftsPanelOpen(false);
            return;
        }

        if (hasUnsavedChanges()) {
            // Show confirmation
            const confirmed = await confirm({
                title: t({
                    id: 'editor.unsaved.title',
                    message: 'Unsaved changes'
                }),
                message: t({
                    id: 'editor.unsaved.switch_draft_description',
                    message: 'Your current edits have not been saved. Switch to another draft?'
                }),
                confirmText: t({
                    id: 'editor.unsaved.switch_draft',
                    message: 'Switch draft'
                }),
                cancelText: t({
                    id: 'common.cancel',
                    message: 'Cancel'
                })
            });

            if (confirmed) {
                window.location.assign(`/write?draft=${url}`);
            }
        } else {
            // Navigate directly
            window.location.assign(`/write?draft=${url}`);
        }
    };

    const handleManualSave = async () => {
        if (isEditorMediaUploading) {
            toast.warning(t({
                id: 'editor.media.wait_before_save',
                message: 'Wait for the upload to finish before saving.'
            }));
            return;
        }

        const savedDraftUrl = await manualSave();
        if (savedDraftUrl) {
            toast.success(t({
                id: 'editor.autosave.saved',
                message: 'Draft saved.'
            }));
        } else {
            toast.error(t({
                id: 'editor.autosave.error',
                message: 'Could not save the draft.'
            }));
        }
    };

    const handleOpenPreview = async (event: MouseEvent<HTMLButtonElement>) => {
        previewTriggerRef.current = event.currentTarget;

        if (isEditorMediaUploading) {
            toast.warning(t({
                id: 'editor.media.wait_before_preview',
                message: 'Wait for the upload to finish before opening the preview.'
            }));
            return;
        }

        setIsPreparingPreview(true);
        try {
            const savedDraftUrl = await manualSave();
            if (!savedDraftUrl) {
                toast.error(t({
                    id: 'editor.preview.error.save_draft',
                    message: 'Could not save the draft for preview.'
                }));
                return;
            }

            setPreviewUrl(`/write/preview/${encodeURIComponent(savedDraftUrl)}`);
            setIsPreviewOpen(true);
        } finally {
            setIsPreparingPreview(false);
        }
    };

    const handleStartFirstPublishGuide = async () => {
        try {
            await startFirstPublishTourDriver({ returnFocusTo: firstPublishGuideButtonRef.current });
        } catch {
            toast.error(t({
                id: 'editor.guide.error.load',
                message: 'Could not load the guide.'
            }));
        }
    };

    const handleTitleChange = (title: string) => {
        setFormData(prev => ({
            ...prev,
            title,
            url: isUrlAutoSync ? (title ? generateUrlFromTitle(title) : '') : prev.url
        }));
    };

    const handleSubtitleChange = (subtitle: string) => {
        setFormData(prev => ({
            ...prev,
            subtitle
        }));
    };

    const handleUrlChange = (url: string) => {
        const cleanUrl = normalizeUrlInput(url);
        const autoGeneratedUrl = generateUrlFromTitle(formData.title);
        setIsUrlAutoSync(cleanUrl === '' || cleanUrl === autoGeneratedUrl);

        setFormData(prev => ({
            ...prev,
            url: cleanUrl
        }));
    };

    const submitCurrentPost = async (isDraft = false) => {
        await submitForm(
            {
                title: formData.title,
                url: normalizeUrlForSubmit(formData.url),
                content: formData.content,
                tags,
                seriesId: selectedSeries.id,
                coverLayout: formData.coverLayout,
                coverImagePosition: formData.coverImagePosition,
                coverImageRatio: formData.coverImageRatio,
                imageDeleted,
                reservedDate: formData.reservedDate
            },
            isDraft,
            false // isEdit
        );
    };

    const handleSubmit = async (isDraft = false) => {
        if (isEditorMediaUploading) {
            toast.warning(formData.reservedDate
                ? t({
                    id: 'editor.media.wait_before_schedule',
                    message: 'Wait for the upload to finish before scheduling.'
                })
                : t({
                    id: 'editor.media.wait_before_publish',
                    message: 'Wait for the upload to finish before publishing.'
                }));
            return;
        }

        if (isDraft) {
            await submitCurrentPost(true);
            return;
        }

        setShowPublishChecklist(true);

        if (!publishChecklist.canPublish) {
            return;
        }
    };

    const handleConfirmPublish = async () => {
        if (isEditorMediaUploading) {
            toast.warning(formData.reservedDate
                ? t({
                    id: 'editor.media.wait_before_schedule',
                    message: 'Wait for the upload to finish before scheduling.'
                })
                : t({
                    id: 'editor.media.wait_before_publish',
                    message: 'Wait for the upload to finish before publishing.'
                }));
            return;
        }

        if (publishChecklist.missingRecommended.length > 0) {
            const labels = publishChecklist.missingRecommended.map(item => item.label).join(', ');
            toast.warning(i18n._({
                id: 'editor.publish.recommended_missing',
                message: 'Recommended fields are empty: {fields}',
                values: { fields: labels }
            }));
        }

        setShowPublishChecklist(false);
        await submitCurrentPost(false);
    };

    return (
        <PostEditorWrapper>
            {shouldShowFirstPublishGuide && (
                <div className="mb-4 flex justify-end">
                    <button
                        ref={firstPublishGuideButtonRef}
                        type="button"
                        onClick={handleStartFirstPublishGuide}
                        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-line bg-surface px-3.5 py-2 text-sm font-medium text-content-secondary shadow-subtle transition-all duration-150 hover:bg-surface-elevated hover:text-content active:scale-95"
                        aria-label={t({
                            id: 'editor.guide.open',
                            message: 'Open first-publish guide'
                        })}
                        title={t({
                            id: 'editor.guide.open',
                            message: 'Open first-publish guide'
                        })}>
                        <Info className="h-4 w-4 shrink-0" />
                        <span><Trans id="editor.guide.title">First-publish guide</Trans></span>
                    </button>
                </div>
            )}

            <PostForm
                beforeContent={<ScheduleStatusNotice value={formData.reservedDate} />}
                formRef={formRef}
                isLoading={isLoading}
                formData={formData}
                tags={tags}
                imagePreview={imagePreview}
                selectedSeries={selectedSeries}
                onTitleChange={handleTitleChange}
                onSubtitleChange={handleSubtitleChange}
                onContentChange={(content) => setFormData(prev => ({
                    ...prev,
                    content
                }))}
                onTagsChange={setTags}
                onImageUpload={handleImageUpload}
                onEditorImageUpload={handleEditorImageUpload}
                onEditorImageUploadError={(errorMessage) => toast.error(errorMessage)}
                onEditorUploadStateChange={setIsEditorMediaUploading}
                onRemoveImage={handleRemoveImage}
            />

            {/* Floating Action Bar */}
            <PostActions
                mode={draftUrl ? 'draft' : 'new'}
                isSaving={isSaving}
                isSubmitting={isSubmitting}
                isMediaUploading={isEditorMediaUploading}
                lastSaved={lastSaved}
                hasSaveError={hasSaveError}
                hasPendingChanges={hasPendingChanges}
                autoSaveCountdown={autoSaveCountdown}
                onManualSave={handleManualSave}
                onSubmit={() => handleSubmit()}
                onOpenDrafts={() => setIsDraftsPanelOpen(true)}
                onPreview={handleOpenPreview}
                isPreviewing={isPreparingPreview}
                onOpenSettings={() => setIsSettingsDrawerOpen(true)}
                submitLabel={formData.reservedDate
                    ? t({
                        id: 'editor.actions.schedule',
                        message: 'Schedule'
                    })
                    : undefined}
            />

            <PublishChecklist
                isOpen={showPublishChecklist}
                result={publishChecklist}
                isSubmitting={isSubmitting}
                onClose={() => setShowPublishChecklist(false)}
                onConfirm={handleConfirmPublish}
            />

            <PostPreviewDialog
                isOpen={isPreviewOpen}
                previewUrl={previewUrl}
                returnFocusTo={previewTriggerRef.current}
                onClose={() => setIsPreviewOpen(false)}
            />

            {/* Settings Drawer */}
            <SettingsDrawer
                isOpen={isSettingsDrawerOpen}
                onClose={() => setIsSettingsDrawerOpen(false)}
                isEdit={false}
                url={formData.url}
                metaDescription={formData.metaDescription}
                selectedSeries={selectedSeries}
                seriesList={seriesList}
                formData={formData}
                imagePreview={imagePreview}
                onUrlChange={handleUrlChange}
                onMetaDescriptionChange={(metaDescription) => setFormData(prev => ({
                    ...prev,
                    metaDescription
                }))}
                onSeriesChange={setSelectedSeries}
                onFormDataChange={(field, value) => setFormData(prev => ({
                    ...prev,
                    [field]: value
                }))}
            />

            {/* Drafts Panel */}
            <DraftsPanel
                isOpen={isDraftsPanelOpen}
                onClose={() => setIsDraftsPanelOpen(false)}
                onSelectPost={handleSelectDraft}
                currentDraftUrl={currentDraftUrl}
            />
        </PostEditorWrapper>
    );
};

export default NewPostEditor;
