import { useState, useEffect, useCallback, useMemo } from 'react';
import { http } from '~/modules/http.module';
import { notification } from '@baejino/ui';
import PostHeader from './components/PostHeader';
import PostForm from './components/PostForm';
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
    }), [formData.title, formData.content, tags.join(',')]);

    const autoSaveOptions = useMemo(() => ({
        enabled: true,
        getCsrfToken,
        tempToken,
        onSuccess: handleAutoSaveSuccess,
        onError: handleAutoSaveError
    }), [getCsrfToken, tempToken, handleAutoSaveSuccess, handleAutoSaveError]);

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
                        setFormData(prev => ({
                            ...prev,
                            title: tempData.title || '',
                            content: tempData.textMd || ''
                        }));
                        if (tempData.tag) {
                            setTags(tempData.tag.split(',').filter(Boolean));
                        }
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

    console.log('xxx');

    return (
        <div className="bg-slate-50 py-4 sm:py-8">
            <div className="max-w-7xl w-full mx-auto">
                <PostHeader
                    mode={tempToken ? 'temp' : 'new'}
                    isSaving={isSaving}
                    isSubmitting={isSubmitting}
                    lastSaved={lastSaved}
                    nextSaveIn={nextSaveIn}
                    saveProgress={saveProgress}
                    onManualSave={handleManualSave}
                    onSubmit={() => handleSubmit()}
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
            </div>
        </div>
    );
};

export default NewPostEditor;
