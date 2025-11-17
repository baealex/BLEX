import React, { useState, useEffect, useRef, useCallback } from 'react';
import { notification } from '@baejino/ui';
import { useConfirm } from '~/contexts/ConfirmContext';
import PostHeader from './components/PostHeader';
import PostForm from './components/PostForm';
import SettingsDrawer from './components/SettingsDrawer';
import { getSeries } from '~/lib/api/settings';
import { getPostForEdit } from '~/lib/api/posts';

interface Series {
    id: string;
    name: string;
}

interface EditPostEditorProps {
    username: string;
    postUrl: string;
}

const EditPostEditor: React.FC<EditPostEditorProps> = ({ username, postUrl }) => {
    const { confirm } = useConfirm();
    const [isLoading, setIsLoading] = useState(true);
    const [seriesList, setSeriesList] = useState<Series[]>([]);
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
                const { data: seriesResponse } = await getSeries();
                if (seriesResponse.status === 'DONE') {
                    const mappedSeries = (seriesResponse.body.series || []).map(s => ({
                        id: s.url,
                        name: s.title
                    }));
                    setSeriesList(mappedSeries);
                }

                // Fetch post data for editing
                const { data: postResponse } = await getPostForEdit(username, postUrl);
                if (postResponse.status === 'DONE') {
                    const postData = postResponse.body;
                    setFormData({
                        title: postData.title || '',
                        url: postData.url || '',
                        content: postData.text_md || '',
                        metaDescription: postData.meta_description || '',
                        hide: postData.hide || false,
                        notice: postData.notice || false,
                        advertise: postData.advertise || false
                    });
                    setTags(postData.tag ? postData.tag.split(',') : []);
                    setImagePreview(postData.image || null);
                    setSelectedSeries({
                        id: postData.series || '',
                        name: postData.series || ''
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
        const confirmed = await confirm({
            title: '게시글 삭제',
            message: '정말로 이 게시글을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.',
            confirmText: '삭제',
            variant: 'danger'
        });

        if (!confirmed) return;

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
        return null;
    }

    return (
        <div className="bg-gray-50 min-h-screen relative transition-all duration-300">
            <div className="w-full max-w-4xl mx-auto transition-all duration-300">
                <PostHeader
                    topOnly
                    mode="edit"
                    isSaving={false}
                    isSubmitting={isSubmitting}
                    lastSaved={null}
                    onManualSave={() => { }}
                    onSubmit={() => handleSubmit()}
                    onOpenSettings={() => setIsSettingsDrawerOpen(true)}
                />

                <PostForm
                    formRef={formRef}
                    isLoading={false}
                    isEdit={true}
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
                    onRemoveImage={handleRemoveImage}
                    onDelete={handleDelete}
                    getCsrfToken={getCsrfToken}
                />

                {/* Bottom sticky header */}
                <PostHeader
                    bottomOnly
                    mode="edit"
                    isSaving={false}
                    isSubmitting={isSubmitting}
                    lastSaved={null}
                    onManualSave={() => { }}
                    onSubmit={() => handleSubmit()}
                    onOpenSettings={() => setIsSettingsDrawerOpen(true)}
                />
            </div>

            {/* Settings Drawer */}
            <SettingsDrawer
                isOpen={isSettingsDrawerOpen}
                onClose={() => setIsSettingsDrawerOpen(false)}
                isEdit={true}
                url={formData.url}
                metaDescription={formData.metaDescription}
                selectedSeries={selectedSeries}
                seriesList={seriesList}
                formData={formData}
                onUrlChange={() => { }} // URL is not editable in edit mode
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
        </div>
    );
};

export default EditPostEditor;
