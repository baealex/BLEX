
import {
    useState,
    useEffect,
    useRef
} from 'react';
import { toast } from '~/utils/toast';
import { useConfirm } from '~/hooks/useConfirm';
import PostEditorWrapper from './PostEditorWrapper';
import PostActions from './components/PostActions';
import PostForm from './components/PostForm';
import DraftsPanel from './components/DraftsPanel';
import SettingsDrawer from './components/SettingsDrawer';
import { useAutoSave } from './hooks/useAutoSave';
import { useImageUpload } from './hooks/useImageUpload';
import { useFormSubmit } from './hooks/useFormSubmit';
import { getSeries } from '~/lib/api/settings';
import { getDraft } from '~/lib/api/posts';
import { api } from '~/components/shared';
import type { Series } from './types';

interface NewPostEditorProps {
    draftUrl?: string;
}

const NewPostEditor = ({ draftUrl }: NewPostEditorProps) => {
    const { confirm } = useConfirm();
    const [isLoading, setIsLoading] = useState(true);
    const [seriesList, setSeriesList] = useState<Series[]>([]);
    const [isDraftsPanelOpen, setIsDraftsPanelOpen] = useState(false);
    const [isSettingsDrawerOpen, setIsSettingsDrawerOpen] = useState(false);

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

    // Track initial state for dirty check
    const initialDataRef = useRef({
        title: '',
        content: '',
        tags: [] as string[]
    });

    // Custom hooks
    const {
        imagePreview,
        imageFile,
        imageDeleted,
        handleImageUpload,
        handleRemoveImage,
        setImagePreviewUrl
    } = useImageUpload();

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
        if (url && !draftUrl) {
            const newUrl = new URL(window.location.href);
            newUrl.searchParams.set('draft', url);
            window.history.replaceState({}, '', newUrl.toString());
        }
    };

    const handleAutoSaveError = () => {
        // Auto-save failure is not critical, no notification needed
    };

    const autoSaveData = {
        title: formData.title,
        content: formData.content,
        tags: tags.join(','),
        subtitle: formData.subtitle,
        description: formData.metaDescription,
        seriesUrl: selectedSeries.url || undefined,
        customUrl: formData.url || undefined,
        imageFile,
        imageDeleted
    };

    const autoSaveOptions = {
        enabled: !isLoading,
        draftUrl,
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
        draftUrl,
        onSubmitError: handleSubmitError
    };

    const { formRef, isSubmitting, submitForm } = useFormSubmit(submitOptions);

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
                        const newContent = draftData.textMd || '';
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

                        // Store initial state
                        initialDataRef.current = {
                            title: newTitle,
                            content: newContent,
                            tags: newTags
                        };
                    }
                }
            } catch {
                toast.error(draftUrl ? '임시 포스트 데이터를 불러오는데 실패했습니다.' : '시리즈 목록을 불러오는데 실패했습니다.');
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [draftUrl]);

    // Check if form has unsaved changes
    const hasUnsavedChanges = () => {
        const initial = initialDataRef.current;
        return (
            formData.title !== initial.title ||
            formData.content !== initial.content ||
            JSON.stringify(tags) !== JSON.stringify(initial.tags)
        );
    };

    // Warn on page unload if there are unsaved changes
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (hasUnsavedChanges()) {
                e.preventDefault();
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    });

    // Handle draft selection
    const handleSelectDraft = async (url: string) => {
        if (url === draftUrl) {
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
        if (!formData.title.trim()) {
            toast.error('제목을 입력해주세요.');
            return;
        }

        const success = await manualSave();
        if (success) {
            toast.success('임시저장되었습니다.');
        } else {
            toast.error('임시저장에 실패했습니다.');
        }
    };

    const generateUrlFromTitle = (title: string) => {
        return title
            .toLowerCase()
            .replace(/[^a-z0-9가-힣\s-]/g, '')
            .replace(/\s+/g, '-')
            .substring(0, 50);
    };

    const handleTitleChange = (title: string) => {
        setFormData(prev => ({
            ...prev,
            title,
            url: title ? generateUrlFromTitle(title) : ''
        }));
    };

    const handleSubtitleChange = (subtitle: string) => {
        setFormData(prev => ({
            ...prev,
            subtitle
        }));
    };

    const handleUrlChange = (url: string) => {
        const cleanUrl = url
            .toLowerCase()
            .replace(/[^a-z0-9가-힣\s-]/g, '')
            .replace(/\s+/g, '-');

        setFormData(prev => ({
            ...prev,
            url: cleanUrl
        }));
    };

    const handleSubmit = async (isDraft = false) => {
        await submitForm(
            {
                title: formData.title,
                url: formData.url,
                content: formData.content,
                tags,
                seriesId: selectedSeries.id
            },
            isDraft,
            false // isEdit
        );
    };

    return (
        <PostEditorWrapper>
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
                onRemoveImage={handleRemoveImage}
            />

            {/* Floating Action Bar */}
            <PostActions
                mode={draftUrl ? 'draft' : 'new'}
                isSaving={isSaving}
                isSubmitting={isSubmitting}
                lastSaved={lastSaved}
                hasSaveError={hasSaveError}
                hasPendingChanges={hasPendingChanges}
                autoSaveCountdown={autoSaveCountdown}
                onManualSave={handleManualSave}
                onSubmit={() => handleSubmit()}
                onOpenDrafts={() => setIsDraftsPanelOpen(true)}
                onOpenSettings={() => setIsSettingsDrawerOpen(true)}
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
                currentDraftUrl={draftUrl}
            />
        </PostEditorWrapper>
    );
};

export default NewPostEditor;
