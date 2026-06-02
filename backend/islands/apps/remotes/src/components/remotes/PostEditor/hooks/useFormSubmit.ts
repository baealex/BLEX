import { useState, useRef } from 'react';
import { toast } from '~/utils/toast';
import { hasPublishableContent } from '../utils/publishChecklist';
import { isFutureDateTimeLocal, parseDateTimeLocal, toReservedDateValue } from '../utils/scheduleDate';

interface FormSubmitData {
    title: string;
    url: string;
    content: string;
    tags: string[];
    seriesId: string;
    coverLayout: string;
    coverImagePosition: string;
    coverImageRatio: string;
    imageDeleted?: boolean;
    reservedDate?: string;
}

interface UseFormSubmitOptions {
    draftUrl?: string;
    onBeforeSubmit?: () => void;
    onSubmitSuccess?: () => void;
    onSubmitError?: (error: Error) => void;
}

const normalizeUrlForSubmit = (value: string) => {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9가-힣\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '')
        .substring(0, 50);
};

export const useFormSubmit = (options: UseFormSubmitOptions) => {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const formRef = useRef<HTMLFormElement>(null);
    const {
        draftUrl,
        onBeforeSubmit,
        onSubmitSuccess,
        onSubmitError
    } = options;

    const validateForm = (data: FormSubmitData, isEdit = false, isDraft = false) => {
        if (!data.title.trim()) {
            toast.error('제목을 입력해주세요.');
            return false;
        }

        if (!isDraft && !hasPublishableContent(data.content)) {
            toast.error('내용을 입력해주세요.');
            return false;
        }

        const sanitizedUrl = normalizeUrlForSubmit(data.url);
        if (!isEdit && !sanitizedUrl) {
            toast.error('URL 주소를 입력해주세요.');
            return false;
        }

        if (!isDraft && data.reservedDate) {
            if (!parseDateTimeLocal(data.reservedDate)) {
                toast.error('예약 시간을 확인해주세요.');
                return false;
            }

            if (!isFutureDateTimeLocal(data.reservedDate)) {
                toast.error('예약 시간은 현재 시간 이후로 선택해주세요.');
                return false;
            }
        }

        return true;
    };

    const addHiddenField = (form: HTMLFormElement, name: string, value: string) => {
        let field = form.querySelector(`input[name="${name}"]`) as HTMLInputElement;
        if (!field) {
            field = document.createElement('input');
            field.type = 'hidden';
            field.name = name;
            form.appendChild(field);
        }
        field.value = value;
    };

    const submitForm = async (data: FormSubmitData, isDraft = false, isEdit = false) => {
        if (!validateForm(data, isEdit, isDraft)) return;

        setIsSubmitting(true);
        try {
            const form = formRef.current;
            if (!form) return;

            onBeforeSubmit?.();

            addHiddenField(form, 'url', normalizeUrlForSubmit(data.url));
            addHiddenField(form, 'tag', data.tags.join(','));
            addHiddenField(form, 'series', data.seriesId);
            addHiddenField(form, 'content_html', data.content);
            addHiddenField(form, 'cover_layout', data.coverLayout);
            addHiddenField(form, 'cover_image_position', data.coverImagePosition);
            addHiddenField(form, 'cover_image_ratio', data.coverImageRatio);

            if (isDraft) {
                addHiddenField(form, 'is_draft', 'true');
                if (data.reservedDate !== undefined) {
                    addHiddenField(form, 'reserved_date', data.reservedDate);
                }
            } else if (data.reservedDate) {
                addHiddenField(form, 'reserved_date', toReservedDateValue(data.reservedDate));
            }

            if (data.imageDeleted) {
                addHiddenField(form, 'image_delete', 'true');
                addHiddenField(form, 'remove_image', 'true');
            }

            // Handle draft URL
            const currentDraftUrl = draftUrl || (() => {
                const urlParams = new URLSearchParams(window.location.search);
                return urlParams.get('draft') || '';
            })();

            if (currentDraftUrl) {
                addHiddenField(form, 'draft_url', currentDraftUrl);

                // Remove draft param from URL when submitting the post
                const newUrl = new URL(window.location.href);
                newUrl.searchParams.delete('draft');
                window.history.replaceState({}, '', newUrl.toString());
            }

            form.submit();
            onSubmitSuccess?.();
        } catch (error) {
            const errorMessage = isEdit ? '포스트 수정에 실패했습니다.' : '포스트 저장에 실패했습니다.';
            toast.error(errorMessage);
            onSubmitError?.(error as Error);
            setIsSubmitting(false);
        }
    };

    const deletePost = async () => {
        if (!confirm('정말로 이 포스트를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
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
        } catch (error) {
            toast.error('포스트 삭제에 실패했습니다.');
            onSubmitError?.(error as Error);
            setIsSubmitting(false);
        }
    };

    return {
        formRef,
        isSubmitting,
        submitForm,
        deletePost
    };
};
