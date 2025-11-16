import {
 useState, useEffect, useCallback, useMemo, useRef
} from 'react';
import { http } from '~/modules/http.module';
import { notification } from '@baejino/ui';
import PostHeader from './components/PostHeader';
import PostForm from './components/PostForm';
import TempPostsPanel from './components/TempPostsPanel';
import SettingsDrawer from './components/SettingsDrawer';
import { useAutoSave } from './hooks/useAutoSave';
import { useImageUpload } from './hooks/useImageUpload';
import { useFormSubmit } from './hooks/useFormSubmit';

interface Series {
    id: string;
    name: string;
}

interface NewPostEditorProps {
    tempToken?: string;
}

const NewPostEditor: React.FC<NewPostEditorProps> = ({ tempToken }) => {
    const [isLoading, setIsLoading] = useState(true);
    const [seriesList, setSeriesList] = useState<Series[]>([]);
    const [isTempPostsPanelOpen, setIsTempPostsPanelOpen] = useState(false);
    const [isSettingsDrawerOpen, setIsSettingsDrawerOpen] = useState(false);
    const [pendingTempToken, setPendingTempToken] = useState<string | null>(null);

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
                const { data: seriesResponse } = await http('v1/series');
                if (seriesResponse.status === 'DONE') {
                    setSeriesList(seriesResponse.body.series || []);
                }

                // Fetch temp post data if tempToken exists
                if (tempToken) {
                    const { data: tempResponse } = await http(`v1/temp-posts/${tempToken}`);
                    if (tempResponse.status === 'DONE' && tempResponse.body) {
                        const tempData = tempResponse.body;
                        const newTitle = tempData.title || '';
                        const newContent = tempData.textMd || '';
                        const newTags = tempData.tag ? tempData.tag.split(',').filter(Boolean) : [];

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
                notification(tempToken ? '임시 포스트 데이터를 불러오는데 실패했습니다.' : '시리즈 목록을 불러오는데 실패했습니다.', { type: 'error' });
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
    const handleSelectTempPost = useCallback((token: string) => {
        if (token === tempToken) {
            // Already on this post
            setIsTempPostsPanelOpen(false);
            return;
        }

        if (hasUnsavedChanges()) {
            // Show confirmation
            setPendingTempToken(token);
        } else {
            // Navigate directly
            window.location.href = `/write?tempToken=${token}`;
        }
    }, [tempToken, hasUnsavedChanges]);

    const handleConfirmNavigation = useCallback(() => {
        if (pendingTempToken) {
            window.location.href = `/write?tempToken=${pendingTempToken}`;
        }
    }, [pendingTempToken]);

    const handleCancelNavigation = useCallback(() => {
        setPendingTempToken(null);
    }, []);

    const handleManualSave = async () => {
        if (!formData.title.trim()) {
            notification('제목을 입력해주세요.', { type: 'error' });
            return;
        }

        await manualSave();
        notification('임시저장되었습니다.', { type: 'success' });
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
        <div className="bg-gray-50 min-h-screen relative transition-all duration-300">
            <div className="w-full max-w-4xl mx-auto transition-all duration-300">
                <PostHeader
                    topOnly
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

                <PostForm
                    formRef={formRef}
                    isLoading={isLoading}
                    isEdit={false}
                    formData={formData}
                    tags={tags}
                    imagePreview={imagePreview}
                    selectedSeries={selectedSeries}
                    seriesList={seriesList}
                    onTitleChange={handleTitleChange}
                    onUrlChange={handleUrlChange}
                    onContentChange={(content) => setFormData(prev => ({
                        ...prev,
                        content
                    }))}
                    onMetaDescriptionChange={(metaDescription) => setFormData(prev => ({
                        ...prev,
                        metaDescription
                    }))}
                    onTagsChange={setTags}
                    onImageUpload={handleImageUpload}
                    onRemoveImage={handleRemoveImage}
                    onSeriesChange={setSelectedSeries}
                    onFormDataChange={(field, value) => setFormData(prev => ({
                        ...prev,
                        [field]: value
                    }))}
                    getCsrfToken={getCsrfToken}
                />

                {/* Bottom sticky header */}
                <PostHeader
                    bottomOnly
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
            </div>

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

            {/* Navigation Warning Modal */}
            {pendingTempToken && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black bg-opacity-50" onClick={handleCancelNavigation} />
                    <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">저장되지 않은 변경사항</h3>
                        <p className="text-sm text-gray-600 mb-6">
                            현재 작성 중인 내용이 저장되지 않았습니다. 다른 임시 글로 이동하시겠습니까?
                        </p>
                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={handleCancelNavigation}
                                className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                                취소
                            </button>
                            <button
                                onClick={handleConfirmNavigation}
                                className="px-4 py-2 text-sm bg-black text-white rounded-lg hover:bg-gray-800 transition-colors">
                                이동
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default NewPostEditor;
