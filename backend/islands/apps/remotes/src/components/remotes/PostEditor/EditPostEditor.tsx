import React, { useState, useEffect, useRef } from 'react';
import { toast } from '~/utils/toast';
import { useConfirm } from '~/hooks/useConfirm';
import PostEditorWrapper from './PostEditorWrapper';
import PostActions from './components/PostActions';
import PostForm from './components/PostForm';
import SettingsDrawer from './components/SettingsDrawer';
import { getSeries } from '~/lib/api/settings';
import { getPostForEdit } from '~/lib/api/posts';
import { api } from '~/components/shared';
import { logger } from '~/utils/logger';
import type { ContentType, Series } from './types';

interface EditPostEditorProps {
    username: string;
    postUrl: string;
}

const EditPostEditor = ({ username, postUrl }: EditPostEditorProps) => {
    const { confirm } = useConfirm();
    const [isLoading, setIsLoading] = useState(true);
    const [seriesList, setSeriesList] = useState<Series[]>([]);
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
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [imageDeleted, setImageDeleted] = useState(false);
    const [selectedSeries, setSelectedSeries] = useState<Series>({
        id: '',
        name: '',
        url: ''
    });
    const [contentType, setContentType] = useState<ContentType>('html');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const formRef = useRef<HTMLFormElement>(null);
    const initialDataRef = useRef({
        title: '',
        content: '',
        tags: [] as string[]
    });

    // Fetch data
    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                // Fetch series list
                const { data: seriesResponse } = await getSeries();
                if (seriesResponse.status === 'DONE') {
                    const mappedSeries = (seriesResponse.body.series || []).map(s => ({
                        id: String(s.id),
                        name: s.title,
                        url: s.url
                    }));
                    setSeriesList(mappedSeries);
                }

                // Fetch post data for editing
                const { data: postResponse } = await getPostForEdit(username, postUrl);
                if (postResponse.status === 'DONE') {
                    const postData = postResponse.body;
                    setFormData({
                        title: postData.title || '',
                        subtitle: postData.subtitle || '',
                        url: postData.url || '',
                        content: postData.textHtml || '',
                        metaDescription: postData.description || '',
                        hide: postData.isHide || false,
                        advertise: postData.isAdvertise || false
                    });
                    setContentType(postData.contentType || 'html');
                    setTags(postData.tags || []);
                    initialDataRef.current = {
                        title: postData.title || '',
                        content: postData.textHtml || '',
                        tags: postData.tags || []
                    };
                    setImagePreview(postData.image || null);
                    setSelectedSeries({
                        id: postData.series?.id || '',
                        name: postData.series?.name || '',
                        url: postData.series?.url || ''
                    });
                }
            } catch {
                toast.error('데이터를 불러오는데 실패했습니다.');
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [username, postUrl]);

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

    const handleTitleChange = (title: string) => {
        setFormData(prev => ({
            ...prev,
            title
        }));
    };

    const handleSubtitleChange = (subtitle: string) => {
        setFormData(prev => ({
            ...prev,
            subtitle
        }));
    };

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

    const handleEditorImageUpload = async (file: File) => {
        try {
            const { data } = await api.uploadImage(file);
            if (data.status === 'DONE') {
                return data.body.url;
            }
        } catch (error) {
            logger.error('Image upload failed', error);
            toast.error('이미지 업로드에 실패했습니다.');
        }
        return undefined;
    };

    const validateForm = () => {
        if (!formData.title.trim()) {
            toast.error('제목을 입력해주세요.');
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
            addHiddenField('content_type', contentType);

            if (isDraft) {
                addHiddenField('is_draft', 'true');
            }

            // Handle image deletion
            if (imageDeleted) {
                addHiddenField('image_delete', 'true');
            }

            form.submit();
        } catch {
            toast.error('포스트 수정에 실패했습니다.');
            setIsSubmitting(false);
        }
    };

    const handleDelete = async () => {
        const confirmed = await confirm({
            title: '포스트 삭제',
            message: '정말로 이 포스트를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.',
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
            toast.error('포스트 삭제에 실패했습니다.');
            setIsSubmitting(false);
        }
    };

    if (isLoading) {
        return (
            <PostEditorWrapper>
                <div className="flex items-center justify-center py-32">
                    <div className="text-center space-y-4">
                        <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-gray-200 border-t-gray-900" />
                        <p className="text-gray-500 text-sm font-medium">포스트를 불러오는 중...</p>
                    </div>
                </div>
            </PostEditorWrapper>
        );
    }

    return (
        <PostEditorWrapper>
            <PostForm
                formRef={formRef}
                isLoading={false}
                formData={formData}
                tags={tags}
                imagePreview={imagePreview}
                selectedSeries={selectedSeries}
                contentType={contentType}
                onContentTypeChange={setContentType}
                isContentTypeChangeable={!formData.content.trim()}
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
                mode="edit"
                isSaving={false}
                isSubmitting={isSubmitting}
                lastSaved={null}
                onManualSave={() => { }}
                onSubmit={() => handleSubmit()}
                onOpenSettings={() => setIsSettingsDrawerOpen(true)}
            />

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
                onDelete={handleDelete}
            />
        </PostEditorWrapper>
    );
};

export default EditPostEditor;
