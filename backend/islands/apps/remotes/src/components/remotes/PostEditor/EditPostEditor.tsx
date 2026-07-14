import React, { useState, useEffect, useRef } from 'react';
import { toast } from '~/utils/toast';
import { useConfirm } from '~/hooks/useConfirm';
import PostEditorWrapper from './PostEditorWrapper';
import PostActions from './components/PostActions';
import PostForm from './components/PostForm';
import SettingsDrawer from './components/SettingsDrawer';
import ScheduleStatusNotice from './components/ScheduleStatusNotice';
import { getSeries } from '~/lib/api/settings';
import {
    cancelPostSchedule,
    getPostForEdit,
    publishScheduledPostNow,
    submitPostEdit
} from '~/lib/api/posts';
import { api } from '~/components/shared';
import { logger } from '~/utils/logger';
import type { Series } from './types';
import {
    isFutureDateTimeLocal,
    parseDateTimeLocal,
    toDateTimeLocalValue,
    toReservedDateValue
} from './utils/scheduleDate';

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
    allowComments: boolean;
    coverLayout: string;
    coverImagePosition: string;
    coverImageRatio: string;
    reservedDate: string;
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
        allowComments: true,
        coverLayout: 'default',
        coverImagePosition: 'right',
        coverImageRatio: 'auto',
        reservedDate: ''
    });

    const [tags, setTags] = useState<string[]>([]);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [imageDeleted, setImageDeleted] = useState(false);
    const [selectedSeries, setSelectedSeries] = useState<Series>({
        id: '',
        name: '',
        url: ''
    });
    const [isScheduledPost, setIsScheduledPost] = useState(false);
    const [pendingScheduleAction, setPendingScheduleAction] = useState<'cancel' | 'publish-now' | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isEditorMediaUploading, setIsEditorMediaUploading] = useState(false);

    const formRef = useRef<HTMLFormElement>(null);
    const initialDataRef = useRef<DirtySnapshot | null>(null);
    const isIntentionalSubmitRef = useRef(false);
    const isSubmitLockedRef = useRef(false);

    const createDirtySnapshot = (): DirtySnapshot => ({
        title: formData.title,
        subtitle: formData.subtitle,
        url: formData.url,
        content: formData.content,
        metaDescription: formData.metaDescription,
        hide: formData.hide,
        advertise: formData.advertise,
        allowComments: formData.allowComments,
        coverLayout: formData.coverLayout,
        coverImagePosition: formData.coverImagePosition,
        coverImageRatio: formData.coverImageRatio,
        reservedDate: formData.reservedDate,
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
                    const reservedDate = postData.isScheduled ? toDateTimeLocalValue(postData.publishedDate) : '';
                    setFormData({
                        title: postData.title || '',
                        subtitle: postData.subtitle || '',
                        url: postData.url || '',
                        content: postData.contentHtml || '',
                        metaDescription: postData.description || '',
                        hide: postData.isHide || false,
                        advertise: postData.isAdvertise || false,
                        allowComments: !(postData.blockComment ?? false),
                        coverLayout: postData.coverLayout || 'default',
                        coverImagePosition: postData.coverImagePosition || 'right',
                        coverImageRatio: postData.coverImageRatio || 'auto',
                        reservedDate
                    });
                    setIsScheduledPost(Boolean(postData.isScheduled));
                    setTags(postData.tags || []);
                    initialDataRef.current = {
                        title: postData.title || '',
                        subtitle: postData.subtitle || '',
                        url: postData.url || '',
                        content: postData.contentHtml || '',
                        metaDescription: postData.description || '',
                        hide: postData.isHide || false,
                        advertise: postData.isAdvertise || false,
                        allowComments: !(postData.blockComment ?? false),
                        coverLayout: postData.coverLayout || 'default',
                        coverImagePosition: postData.coverImagePosition || 'right',
                        coverImageRatio: postData.coverImageRatio || 'auto',
                        reservedDate,
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

    const hasReservedDateChanged = () => {
        return formData.reservedDate !== (initialDataRef.current?.reservedDate || '');
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

        if (isScheduledPost && hasReservedDateChanged()) {
            if (!parseDateTimeLocal(formData.reservedDate)) {
                toast.error('예약 시간을 확인해주세요.');
                return false;
            }

            if (!isFutureDateTimeLocal(formData.reservedDate)) {
                toast.error('예약 시간은 현재 시간 이후로 선택해주세요.');
                return false;
            }
        }

        return true;
    };

    const submitCurrentPost = async () => {
        if (!hasUnsavedChanges() || isSubmitLockedRef.current) return;
        if (!validateForm()) return;

        if (isEditorMediaUploading) {
            toast.warning('파일 업로드가 끝난 뒤 수정해주세요.');
            return;
        }

        const form = formRef.current;
        if (!form) return;

        isSubmitLockedRef.current = true;
        setIsSubmitting(true);
        try {
            const payload = new FormData(form);
            payload.set('title', formData.title);
            payload.set('subtitle', formData.subtitle);
            payload.set('url', formData.url);
            payload.set('content_html', formData.content);
            payload.set('meta_description', formData.metaDescription);
            payload.set('hide', formData.hide ? 'true' : 'false');
            payload.set('advertise', formData.advertise ? 'true' : 'false');
            payload.set('block_comment', formData.allowComments ? 'false' : 'true');
            payload.set('tag', tags.join(','));
            payload.set('cover_layout', formData.coverLayout);
            payload.set('cover_image_position', formData.coverImagePosition);
            payload.set('cover_image_ratio', formData.coverImageRatio);

            if (selectedSeries.id) {
                payload.set('series', selectedSeries.id);
            } else {
                payload.delete('series');
            }

            if (isScheduledPost && hasReservedDateChanged()) {
                payload.set('reserved_date', toReservedDateValue(formData.reservedDate));
            } else {
                payload.delete('reserved_date');
            }

            if (imageDeleted) {
                payload.set('image_delete', 'true');
            } else {
                payload.delete('image_delete');
            }

            const { data } = await submitPostEdit(username, postUrl, payload);
            if (data.status === 'ERROR') {
                isSubmitLockedRef.current = false;
                setIsSubmitting(false);
                toast.error(data.errorMessage || '포스트 수정에 실패했습니다.');
                return;
            }

            isIntentionalSubmitRef.current = true;
            window.location.assign(data.body.url);
        } catch {
            isSubmitLockedRef.current = false;
            isIntentionalSubmitRef.current = false;
            toast.error('포스트 수정에 실패했습니다.');
            setIsSubmitting(false);
        }
    };

    const handleSubmit = async () => {
        await submitCurrentPost();
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

    const canRunScheduleAction = () => {
        if (hasUnsavedChanges()) {
            toast.warning('변경 사항을 먼저 수정한 뒤 예약 상태를 변경해주세요.');
            return false;
        }

        if (isEditorMediaUploading) {
            toast.warning('파일 업로드가 끝난 뒤 예약 상태를 변경해주세요.');
            return false;
        }

        return true;
    };

    const handleCancelSchedule = async () => {
        if (!canRunScheduleAction()) return;

        const confirmed = await confirm({
            title: '예약 취소',
            message: '예약을 취소하고 임시글로 되돌립니다. 내용과 설정은 유지되며 공개 화면에는 노출되지 않습니다.',
            confirmText: '예약 취소'
        });
        if (!confirmed) return;

        setPendingScheduleAction('cancel');
        setIsSubmitting(true);
        try {
            const { data } = await cancelPostSchedule(username, postUrl);
            if (data.status === 'ERROR') {
                toast.error(data.errorMessage || '예약 취소에 실패했습니다.');
                return;
            }

            isIntentionalSubmitRef.current = true;
            window.location.assign(`/write?draft=${encodeURIComponent(data.body.url)}`);
        } catch {
            toast.error('예약 취소에 실패했습니다.');
        } finally {
            setPendingScheduleAction(null);
            setIsSubmitting(false);
        }
    };

    const handlePublishNow = async () => {
        if (!canRunScheduleAction()) return;

        const confirmed = await confirm({
            title: '지금 발행',
            message: formData.hide
                ? '예약 시간을 기다리지 않고 비공개 상태로 발행합니다. 작성자 외에는 볼 수 없습니다.'
                : '예약 시간을 기다리지 않고 지금 공개합니다. 연결된 알림 채널에도 발행 소식이 전송됩니다.',
            confirmText: '지금 발행'
        });
        if (!confirmed) return;

        setPendingScheduleAction('publish-now');
        setIsSubmitting(true);
        try {
            const { data } = await publishScheduledPostNow(username, postUrl);
            if (data.status === 'ERROR') {
                toast.error(data.errorMessage || '즉시 발행에 실패했습니다.');
                return;
            }

            isIntentionalSubmitRef.current = true;
            window.location.assign(`/@${encodeURIComponent(username)}/${encodeURIComponent(data.body.url)}`);
        } catch {
            toast.error('즉시 발행에 실패했습니다.');
        } finally {
            setPendingScheduleAction(null);
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
                beforeContent={<ScheduleStatusNotice value={isScheduledPost ? formData.reservedDate : ''} />}
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
                isSubmitDisabled={!hasUnsavedChanges()}
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
                isScheduled={isScheduledPost}
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
                onCancelSchedule={handleCancelSchedule}
                onPublishNow={handlePublishNow}
                pendingScheduleAction={pendingScheduleAction}
            />
        </PostEditorWrapper>
    );
};

export default EditPostEditor;
