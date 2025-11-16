import React, { useState, useEffect, useRef, useCallback } from 'react';
import { http } from '~/modules/http.module';
import { notification } from '@baejino/ui';
import PostHeader from './components/PostHeader';
import PostForm from './components/PostForm';

interface Series {
    id: string;
    name: string;
}

interface EditPostEditorProps {
    username: string;
    postUrl: string;
}

const EditPostEditor: React.FC<EditPostEditorProps> = ({ username, postUrl }) => {
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
    const [imageDeleted, setImageDeleted] = useState(false);
    const [selectedSeries, setSelectedSeries] = useState({
        id: '',
        name: ''
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

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

                // Fetch post data for editing
                const { data: postResponse } = await http(`v1/users/@${username}/posts/${postUrl}?mode=edit`);
                if (postResponse.status === 'DONE') {
                    const postData = postResponse.body;
                    setFormData({
                        title: postData.title || '',
                        url: postData.url || '',
                        content: postData.textHtml || '',
                        metaDescription: postData.description || '',
                        hide: postData.isHide || false,
                        notice: postData.isNotice || false,
                        advertise: postData.isAdvertise || false
                    });
                    setTags(postData.tags || []);
                    setImagePreview(postData.image || null);
                    setSelectedSeries({
                        id: postData.series?.id || '',
                        name: postData.series?.name || ''
                    });
                }
            } catch {
                notification('데이터를 불러오는데 실패했습니다.', { type: 'error' });
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [username, postUrl]);

    const handleTitleChange = useCallback((title: string) => {
        setFormData(prev => ({
            ...prev,
            title
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
        setImageDeleted(true);
    };

    const validateForm = () => {
        if (!formData.title.trim()) {
            notification('제목을 입력해주세요.', { type: 'error' });
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
            addHiddenField('text_html', formData.content);

            if (isDraft) {
                addHiddenField('is_draft', 'true');
            }

            // Handle image deletion
            if (imageDeleted) {
                addHiddenField('image_delete', 'true');
            }

            form.submit();
        } catch {
            notification('게시글 수정에 실패했습니다.', { type: 'error' });
            setIsSubmitting(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm('정말로 이 게시글을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
            return;
        }

        setIsSubmitting(true);
        try {
            const form = formRef.current;
            if (!form) return;

            const deleteField = document.createElement('input');
            deleteField.type = 'hidden';
            deleteField.name = 'delete';
            deleteField.value = 'true';
            form.appendChild(deleteField);

            form.submit();
        } catch {
            notification('게시글 삭제에 실패했습니다.', { type: 'error' });
            setIsSubmitting(false);
        }
    };

    if (isLoading) {
        return (
            <div className="bg-gray-50 py-4 sm:py-8">
                <div className="max-w-4xl w-full mx-auto">
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                        <div className="animate-pulse space-y-4">
                            <div className="h-8 bg-gray-200 rounded w-1/3" />
                            <div className="h-4 bg-gray-200 rounded w-2/3" />
                            <div className="h-32 bg-gray-200 rounded" />
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-gray-50 py-4 sm:py-8">
            <div className="max-w-4xl w-full mx-auto">
                <PostHeader
                    mode="edit"
                    isSaving={false}
                    isSubmitting={isSubmitting}
                    lastSaved={null}
                    onManualSave={() => { }}
                    onSubmit={() => handleSubmit()}
                />

                <PostForm
                    formRef={formRef}
                    isLoading={false}
                    isEdit={true}
                    formData={formData}
                    tags={tags}
                    imagePreview={imagePreview}
                    selectedSeries={selectedSeries}
                    seriesList={seriesList}
                    onTitleChange={handleTitleChange}
                    onUrlChange={() => { }} // URL is not editable in edit mode
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
                    onDelete={handleDelete}
                    getCsrfToken={getCsrfToken}
                />
            </div>
        </div>
    );
};

export default EditPostEditor;
