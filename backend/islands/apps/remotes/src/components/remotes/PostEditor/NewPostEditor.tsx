import {
 useState,
 useEffect,
 useCallback,
 useMemo,
 useRef
} from 'react';
import { toast } from '~/utils/toast';
import { useConfirm } from '~/contexts/ConfirmContext';
import PostEditorWrapper from './PostEditorWrapper';
import PostActions from './components/PostActions';
import PostForm from './components/PostForm';
import TempPostsPanel from './components/TempPostsPanel';
import SettingsDrawer from './components/SettingsDrawer';
import { useAutoSave } from './hooks/useAutoSave';
import { useImageUpload } from './hooks/useImageUpload';
import { useFormSubmit } from './hooks/useFormSubmit';
import { getSeries } from '~/lib/api/settings';
import { getTempPost } from '~/lib/api/posts';
import { api } from '~/components/shared';

interface Series {
    id: string;
    name: string;
}

interface NewPostEditorProps {
    tempToken?: string;
}

const NewPostEditor = ({ tempToken }: NewPostEditorProps) => {
    const { confirm } = useConfirm();
    const [isLoading, setIsLoading] = useState(true);
    const [seriesList, setSeriesList] = useState<Series[]>([]);
    const [isTempPostsPanelOpen, setIsTempPostsPanelOpen] = useState(false);
    const [isSettingsDrawerOpen, setIsSettingsDrawerOpen] = useState(false);

    const [formData, setFormData] = useState({
        title: '',
        url: '',
        content: '',
        metaDescription: '',
        hide: false,
        notice: false,
        advertise: false
    });

    const [tags, setTags] = useState<string[]>([]);
    const [selectedSeries, setSelectedSeries] = useState({
        id: '',
        name: ''
    });

    // Track initial state for dirty check
    const initialDataRef = useRef({
        title: '',
        content: '',
        tags: [] as string[]
    });

    // Get CSRF token from DOM
    const getCsrfToken = useCallback(() => {
        const tokenElement = document.querySelector('[name=csrfmiddlewaretoken]') as HTMLInputElement;
        return tokenElement ? tokenElement.value : '';
    }, []);

    // Custom hooks
    const { imagePreview, handleImageUpload, handleRemoveImage } = useImageUpload();

    const handleEditorImageUpload = useCallback(async (file: File) => {
        try {
            const { data } = await api.uploadImage(file);
            if (data.status === 'DONE') {
                return data.body.url;
            }
        } catch (error) {
            console.error('Image upload failed', error);
        }
        return undefined;
    }, []);

    const handleAutoSaveSuccess = useCallback((token?: string) => {
        // Update URL to include tempToken for first save
        if (token && !tempToken) {
            const newUrl = new URL(window.location.href);
            newUrl.searchParams.set('tempToken', token);
            window.history.replaceState({}, '', newUrl.toString());
        }
    }, [tempToken]);

    const handleAutoSaveError = useCallback(() => {
        // Auto-save failure is not critical, no notification needed
    }, []);

    const autoSaveData = useMemo(() => ({
        title: formData.title,
        content: formData.content,
        tags: tags.join(',')
    }), [formData.title, formData.content, tags]);

    const autoSaveOptions = useMemo(() => ({
        enabled: !isLoading,
        getCsrfToken,
        tempToken,
        onSuccess: handleAutoSaveSuccess,
        onError: handleAutoSaveError
    }), [getCsrfToken, tempToken, handleAutoSaveSuccess, handleAutoSaveError, isLoading]);

    const {
        lastSaved,
        isSaving,
        nextSaveIn,
        saveProgress,
        manualSave
    } = useAutoSave(autoSaveData, autoSaveOptions);

    const handleSubmitError = useCallback(() => {
        // Error notification is handled inside useFormSubmit
    }, []);

    const submitOptions = useMemo(() => ({
        getCsrfToken,
        onSubmitError: handleSubmitError
    }), [getCsrfToken, handleSubmitError]);

    const { formRef, isSubmitting, submitForm } = useFormSubmit(submitOptions);

    // Fetch series list and temp post data if tempToken exists
    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                // Fetch series list
                const { data: seriesResponse } = await getSeries();
                if (seriesResponse.status === 'DONE') {
                    const mappedSeries = (seriesResponse.body.series || []).map(s => ({
                        id: String(s.id),
                        name: s.title
                    }));
                    setSeriesList(mappedSeries);
                }

                // Fetch temp post data if tempToken exists
                if (tempToken) {
                    const { data: tempResponse } = await getTempPost(tempToken);
                    if (tempResponse.status === 'DONE' && tempResponse.body) {
                        const tempData = tempResponse.body;
                        const newTitle = tempData.title || '';
                        const newContent = tempData.textMd || '';
                        const newTags = tempData.tags ? tempData.tags.split(',').filter(Boolean) : [];

                        setFormData(prev => ({
                            ...prev,
                            title: newTitle,
                            content: newContent
                        }));
                        setTags(newTags);

                        // Store initial state
                        initialDataRef.current = {
                            title: newTitle,
                            content: newContent,
                            tags: newTags
                        };
                    }
                }
            } catch {
                toast.error(tempToken ? '임시 포스트 데이터를 불러오는데 실패했습니다.' : '시리즈 목록을 불러오는데 실패했습니다.');
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [tempToken]);

    // Check if form has unsaved changes
    const hasUnsavedChanges = useCallback(() => {
        const initial = initialDataRef.current;
        return (
            formData.title !== initial.title ||
            formData.content !== initial.content ||
            JSON.stringify(tags) !== JSON.stringify(initial.tags)
        );
    }, [formData.title, formData.content, tags]);

    // Handle temp post selection
    const handleSelectTempPost = useCallback(async (token: string) => {
        if (token === tempToken) {
            // Already on this post
            setIsTempPostsPanelOpen(false);
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
                window.location.href = `/write?tempToken=${token}`;
            }
        } else {
            // Navigate directly
            window.location.href = `/write?tempToken=${token}`;
        }
    }, [tempToken, hasUnsavedChanges, confirm]);

    const handleManualSave = async () => {
        if (!formData.title.trim()) {
            toast.error('제목을 입력해주세요.');
            return;
        }

        await manualSave();
        toast.success('임시저장되었습니다.');
    };

    const generateUrlFromTitle = (title: string) => {
        return title
            .toLowerCase()
            .replace(/[^a-z0-9가-힣\s-]/g, '')
            .replace(/\s+/g, '-')
            .substring(0, 50);
    };

    const handleTitleChange = useCallback((title: string) => {
        setFormData(prev => ({
            ...prev,
            title,
            url: title ? generateUrlFromTitle(title) : ''
        }));
    }, []);

    const handleUrlChange = useCallback((url: string) => {
        const cleanUrl = url
            .toLowerCase()
            .replace(/[^a-z0-9가-힣\s-]/g, '')
            .replace(/\s+/g, '-');

        setFormData(prev => ({
            ...prev,
            url: cleanUrl
        }));
    }, []);

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
                isEdit={false}
                formData={formData}
                tags={tags}
                imagePreview={imagePreview}
                selectedSeries={selectedSeries}
                onTitleChange={handleTitleChange}
                onContentChange={(content) => setFormData(prev => ({
                    ...prev,
                    content
                }))}
                onTagsChange={setTags}
                onImageUpload={handleImageUpload}
                onEditorImageUpload={handleEditorImageUpload}
                onRemoveImage={handleRemoveImage}
                getCsrfToken={getCsrfToken}
            />

            {/* Floating Action Bar */}
            <PostActions
                mode={tempToken ? 'temp' : 'new'}
                isSaving={isSaving}
                isSubmitting={isSubmitting}
                lastSaved={lastSaved}
                nextSaveIn={nextSaveIn}
                saveProgress={saveProgress}
                onManualSave={handleManualSave}
                onSubmit={() => handleSubmit()}
                onOpenTempPosts={() => setIsTempPostsPanelOpen(true)}
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

            {/* Temp Posts Panel */}
            <TempPostsPanel
                isOpen={isTempPostsPanelOpen}
                onClose={() => setIsTempPostsPanelOpen(false)}
                onSelectPost={handleSelectTempPost}
                currentToken={tempToken}
            />
        </PostEditorWrapper>
    );
};

export default NewPostEditor;
