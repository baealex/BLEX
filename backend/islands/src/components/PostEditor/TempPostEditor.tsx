import React, { useState, useEffect, useRef, useCallback } from 'react';
import { http } from '~/modules/http.module';
import { notification } from '@baejino/ui';
import PostHeader from './components/PostHeader';
import PostForm from './components/PostForm';

interface Series {
    id: string;
    name: string;
}

interface TempPostEditorProps {
    tempToken: string;
}

const TempPostEditor: React.FC<TempPostEditorProps> = ({ tempToken }) => {
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
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [selectedSeries, setSelectedSeries] = useState({
        id: '',
        name: ''
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [lastSaved, setLastSaved] = useState<Date | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const autoSaveRef = useRef<number | null>(null);
    const formRef = useRef<HTMLFormElement>(null);

    // Get CSRF token from DOM
    const getCsrfToken = () => {
        const tokenElement = document.querySelector('[name=csrfmiddlewaretoken]') as HTMLInputElement;
        return tokenElement ? tokenElement.value : '';
    };

    // Fetch data
    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                // Fetch series list
                const { data: seriesResponse } = await http('v1/series');
                if (seriesResponse.status === 'DONE') {
                    setSeriesList(seriesResponse.body.series || []);
                }

                // Fetch temp post data
                const { data: tempResponse } = await http(`v1/temp-posts/${tempToken}`);
                if (tempResponse.status === 'DONE') {
                    const tempData = tempResponse.body;
                    setFormData({
                        title: tempData.title || '',
                        url: tempData.url || '',
                        content: tempData.textMd || '',
                        metaDescription: tempData.metaDescription || '',
                        hide: tempData.hide || false,
                        notice: tempData.notice || false,
                        advertise: tempData.advertise || false
                    });
                    const tempTags = tempData.tags ? tempData.tags.split(',').filter((tag: string) => tag.trim() !== '') : [];
                    setTags(tempTags);
                }
            } catch {
                notification('임시저장 데이터를 불러오는데 실패했습니다.', { type: 'error' });
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [tempToken]);

    // Handle series selection after seriesList is loaded
    useEffect(() => {
        if (seriesList.length > 0 && formData.title) {
            // Try to find and set series if it was saved in temp data
            // This would need to be implemented based on how series is stored in temp data
        }
    }, [seriesList, formData.title]);

    const handleAutoSave = useCallback(async () => {
        if (isSaving || isSubmitting) return;

        setIsSaving(true);
        try {
            const tempData = new URLSearchParams();
            tempData.append('title', formData.title || '제목 없음');
            tempData.append('text_md', formData.content);
            tempData.append('tag', tags.join(','));

            const response = await http(`v1/temp-posts/${tempToken}`, {
                method: 'PUT',
                data: tempData,
                headers: {
                    'X-CSRFToken': getCsrfToken(),
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            });

            if (response.data?.status === 'DONE') {
                setLastSaved(new Date());
            }
        } catch {
            // Auto-save failure is not critical
        } finally {
            setIsSaving(false);
        }
    }, [isSaving, isSubmitting, formData, tags, tempToken]);

    // Auto-save functionality
    useEffect(() => {
        if (autoSaveRef.current) {
            clearTimeout(autoSaveRef.current);
        }

        autoSaveRef.current = window.setTimeout(() => {
            if (formData.title || formData.content) {
                handleAutoSave();
            }
        }, 30000); // Auto-save every 30 seconds

        return () => {
            if (autoSaveRef.current) {
                clearTimeout(autoSaveRef.current);
            }
        };
    }, [formData, tags, selectedSeries, handleAutoSave]);

    const handleManualSave = async () => {
        if (!formData.title.trim()) {
            notification('제목을 입력해주세요.', { type: 'error' });
            return;
        }

        await handleAutoSave();
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
            url: prev.url || (title ? generateUrlFromTitle(title) : '')
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

    const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                setImagePreview(e.target?.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleRemoveImage = () => {
        setImagePreview(null);
    };

    const validateForm = () => {
        if (!formData.title.trim()) {
            notification('제목을 입력해주세요.', { type: 'error' });
            return false;
        }

        if (!formData.url.trim()) {
            notification('URL 주소를 입력해주세요.', { type: 'error' });
            return false;
        }

        return true;
    };

    const handleSubmit = async (isDraft = false) => {
        if (!validateForm()) return;

        setIsSubmitting(true);
        try {
            const form = formRef.current;
            if (!form) return;

            // Add hidden fields for React data
            const addHiddenField = (name: string, value: string) => {
                let field = form.querySelector(`input[name="${name}"]`) as HTMLInputElement;
                if (!field) {
                    field = document.createElement('input');
                    field.type = 'hidden';
                    field.name = name;
                    form.appendChild(field);
                }
                field.value = value;
            };

            addHiddenField('tag', tags.join(','));
            addHiddenField('series', selectedSeries.id);
            addHiddenField('text_md', formData.content);
            addHiddenField('token', tempToken);

            if (isDraft) {
                addHiddenField('is_draft', 'true');
            }

            // Remove tempToken from URL when submitting the post
            const newUrl = new URL(window.location.href);
            newUrl.searchParams.delete('tempToken');
            window.history.replaceState({}, '', newUrl.toString());

            form.submit();
        } catch {
            notification('게시글 저장에 실패했습니다.', { type: 'error' });
            setIsSubmitting(false);
        }
    };

    if (isLoading) {
        return (
            <div className="bg-slate-50 py-4 sm:py-8">
                <div className="max-w-7xl w-full mx-auto">
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                        <div className="animate-pulse space-y-4">
                            <div className="h-8 bg-slate-200 rounded w-1/3" />
                            <div className="h-4 bg-slate-200 rounded w-2/3" />
                            <div className="h-32 bg-slate-200 rounded" />
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-slate-50 py-4 sm:py-8">
            <div className="max-w-7xl w-full mx-auto">
                <PostHeader
                    mode="temp"
                    isSaving={isSaving}
                    isSubmitting={isSubmitting}
                    lastSaved={lastSaved}
                    onManualSave={handleManualSave}
                    onSubmit={() => handleSubmit()}
                />

                <PostForm
                    formRef={formRef}
                    isLoading={false}
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

export default TempPostEditor;
