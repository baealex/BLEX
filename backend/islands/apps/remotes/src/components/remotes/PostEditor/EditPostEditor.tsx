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
import type { Series } from './types';

interface EditPostEditorProps {
    username: string;
    postUrl: string;
}

interface DirtySnapshot {
    title: string;
    subtitle: string;
    url: string;
    content: string;
    metaDescription: string;
    hide: boolean;
    advertise: boolean;
    coverLayout: string;
    coverImagePosition: string;
    coverImageRatio: string;
    tags: string[];
    seriesUrl: string;
    imagePreview: string | null;
    imageDeleted: boolean;
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
        advertise: false,
        coverLayout: 'default',
        coverImagePosition: 'right',
        coverImageRatio: 'auto'
    });

    const [tags, setTags] = useState<string[]>([]);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [imageDeleted, setImageDeleted] = useState(false);
    const [selectedSeries, setSelectedSeries] = useState<Series>({
        id: '',
        name: '',
        url: ''
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isEditorMediaUploading, setIsEditorMediaUploading] = useState(false);

    const formRef = useRef<HTMLFormElement>(null);
    const initialDataRef = useRef<DirtySnapshot | null>(null);
    const isIntentionalSubmitRef = useRef(false);

    const createDirtySnapshot = (): DirtySnapshot => ({
        title: formData.title,
        subtitle: formData.subtitle,
        url: formData.url,
        content: formData.content,
        metaDescription: formData.metaDescription,
        hide: formData.hide,
        advertise: formData.advertise,
        coverLayout: formData.coverLayout,
        coverImagePosition: formData.coverImagePosition,
        coverImageRatio: formData.coverImageRatio,
        tags,
        seriesUrl: selectedSeries.url,
        imagePreview,
        imageDeleted
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
                        content: postData.contentHtml || '',
                        metaDescription: postData.description || '',
                        hide: postData.isHide || false,
                        advertise: postData.isAdvertise || false,
                        coverLayout: postData.coverLayout || 'default',
                        coverImagePosition: postData.coverImagePosition || 'right',
                        coverImageRatio: postData.coverImageRatio || 'auto'
                    });
                    setTags(postData.tags || []);
                    initialDataRef.current = {
                        title: postData.title || '',
                        subtitle: postData.subtitle || '',
                        url: postData.url || '',
                        content: postData.contentHtml || '',
                        metaDescription: postData.description || '',
                        hide: postData.isHide || false,
                        advertise: postData.isAdvertise || false,
                        coverLayout: postData.coverLayout || 'default',
                        coverImagePosition: postData.coverImagePosition || 'right',
                        coverImageRatio: postData.coverImageRatio || 'auto',
                        tags: postData.tags || [],
                        seriesUrl: postData.series?.url || '',
                        imagePreview: postData.image || null,
                        imageDeleted: false
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
        if (!initialDataRef.current) return false;
        return JSON.stringify(createDirtySnapshot()) !== JSON.stringify(initialDataRef.current);
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
                setImageDeleted(false);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleRemoveImage = () => {
        setImagePreview(null);
        setImageDeleted(true);
    };

    const handleEditorImageUpload = async (file: File) => {
        const { data } = await api.uploadImage(file).catch((error) => {
            logger.error('Image upload failed', error);
            throw new Error('파일 업로드에 실패했습니다.');
        });

        if (data.status === 'DONE') {
            return data.body.url;
        }

        throw new Error(data.errorMessage || '파일 업로드에 실패했습니다.');
    };

    const validateForm = () => {
        if (!formData.title.trim()) {
            toast.error('제목을 입력해주세요.');
            return false;
        }

        return true;
    };

    const submitCurrentPost = async (isDraft = false) => {
        if (!validateForm()) return;

        if (isEditorMediaUploading) {
            toast.warning('파일 업로드가 끝난 뒤 수정해주세요.');
            return;
        }

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
            addHiddenField('content_html', formData.content);
            addHiddenField('cover_layout', formData.coverLayout);
            addHiddenField('cover_image_position', formData.coverImagePosition);
            addHiddenField('cover_image_ratio', formData.coverImageRatio);

            if (isDraft) {
                addHiddenField('is_draft', 'true');
            }

            // Handle image deletion
            if (imageDeleted) {
                addHiddenField('image_delete', 'true');
            }

            isIntentionalSubmitRef.current = true;
            form.submit();
        } catch {
            isIntentionalSubmitRef.current = false;
            toast.error('포스트 수정에 실패했습니다.');
            setIsSubmitting(false);
        }
    };

    const handleSubmit = async (isDraft = false) => {
        await submitCurrentPost(isDraft);
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
                        <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-line border-t-action" />
                        <p className="text-content-secondary text-sm font-medium">포스트를 불러오는 중...</p>
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
                mode="edit"
                isSaving={false}
                isSubmitting={isSubmitting}
                isMediaUploading={isEditorMediaUploading}
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
                imagePreview={imagePreview}
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
