
import {
    useState,
    useEffect,
    useMemo,
    useRef,
    useCallback
} from 'react';
import { toast } from '~/utils/toast';
import { useConfirm } from '~/hooks/useConfirm';
import PostEditorWrapper from './PostEditorWrapper';
import PostActions from './components/PostActions';
import PostForm from './components/PostForm';
import DraftsPanel from './components/DraftsPanel';
import SettingsDrawer from './components/SettingsDrawer';
import PublishChecklist from './components/PublishChecklist';
import { useAutoSave } from './hooks/useAutoSave';
import { useImageUpload } from './hooks/useImageUpload';
import { useFormSubmit } from './hooks/useFormSubmit';
import { Info } from '@blex/ui/icons';
import { startFirstPublishTour as startFirstPublishTourDriver } from './utils/firstPublishTour';
import { getPublishChecklist } from './utils/publishChecklist';
import { getSeries } from '~/lib/api/settings';
import { getDraft } from '~/lib/api/posts';
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
    const { confirm } = useConfirm();
    const [isLoading, setIsLoading] = useState(true);
    const [seriesList, setSeriesList] = useState<Series[]>([]);
    const [isDraftsPanelOpen, setIsDraftsPanelOpen] = useState(false);
    const [isSettingsDrawerOpen, setIsSettingsDrawerOpen] = useState(false);
    const [isUrlAutoSync, setIsUrlAutoSync] = useState(true);
    const [currentDraftUrl, setCurrentDraftUrl] = useState(draftUrl);
    const [showPublishChecklist, setShowPublishChecklist] = useState(false);
    const [isEditorMediaUploading, setIsEditorMediaUploading] = useState(false);

    const [formData, setFormData] = useState({
        title: '',
        subtitle: '',
        url: '',
        content: '',
        metaDescription: '',
        hide: false,
        advertise: false
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
        tags,
        seriesUrl: selectedSeries.url || '',
        imagePreview: imagePreview || '',
        imageFilePending: Boolean(imageFile),
        imageDeleted
    }), [formData, tags, selectedSeries.url, imagePreview, imageFile, imageDeleted]);

    const handleEditorImageUpload = async (file: File) => {
        try {
            const { data } = await api.uploadImage(file);
            if (data.status === 'DONE') {
                return data.body.url;
            }
        } catch {
            toast.error('이미지 업로드에 실패했습니다.');
        }
        return undefined;
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

    const publishChecklist = useMemo(() => getPublishChecklist({
        title: formData.title,
        content: formData.content,
        description: formData.metaDescription,
        tags,
        hasCoverImage: Boolean(imagePreview),
        isHidden: formData.hide
    }), [formData.title, formData.content, formData.metaDescription, formData.hide, tags, imagePreview]);

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

                        setFormData(prev => ({
                            ...prev,
                            title: newTitle,
                            subtitle: newSubtitle,
                            url: draftData.url || '',
                            content: newContent,
                            metaDescription: newDescription
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
                toast.error(draftUrl ? '임시 포스트 데이터를 불러오는데 실패했습니다.' : '시리즈 목록을 불러오는데 실패했습니다.');
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [draftUrl, setImagePreviewUrl]);

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
                title: '저장되지 않은 변경사항',
                message: '현재 작성 중인 내용이 저장되지 않았습니다. 다른 임시 글로 이동하시겠습니까?',
                confirmText: '이동',
                cancelText: '취소'
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
            toast.warning('파일 업로드가 끝난 뒤 저장해주세요.');
            return;
        }

        const success = await manualSave();
        if (success) {
            toast.success('임시저장되었습니다.');
        } else {
            toast.error('임시저장에 실패했습니다.');
        }
    };

    const handleStartFirstPublishGuide = async () => {
        try {
            await startFirstPublishTourDriver({ returnFocusTo: firstPublishGuideButtonRef.current });
        } catch {
            toast.error('가이드를 불러오는데 실패했습니다.');
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
                imageDeleted
            },
            isDraft,
            false // isEdit
        );
    };

    const handleSubmit = async (isDraft = false) => {
        if (isEditorMediaUploading) {
            toast.warning('파일 업로드가 끝난 뒤 발행해주세요.');
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
            toast.warning('파일 업로드가 끝난 뒤 발행해주세요.');
            return;
        }

        if (publishChecklist.missingRecommended.length > 0) {
            const labels = publishChecklist.missingRecommended.map(item => item.label).join(', ');
            toast.warning(`권장 항목이 비어 있습니다: ${labels}`);
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
                        aria-label="첫 발행 가이드 열기"
                        title="첫 발행 가이드 열기">
                        <Info className="h-4 w-4 shrink-0" />
                        <span>첫 발행 가이드</span>
                    </button>
                </div>
            )}

            <PostForm
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
                onOpenSettings={() => setIsSettingsDrawerOpen(true)}
            />

            <PublishChecklist
                isOpen={showPublishChecklist}
                result={publishChecklist}
                isSubmitting={isSubmitting}
                onClose={() => setShowPublishChecklist(false)}
                onConfirm={handleConfirmPublish}
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
