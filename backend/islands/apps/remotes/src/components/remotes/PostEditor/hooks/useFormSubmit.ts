import { useState, useRef } from 'react';
import { toast } from '~/utils/toast';

interface FormSubmitData {
    title: string;
    url: string;
    content: string;
    tags: string[];
    seriesId: string;
}

interface UseFormSubmitOptions {
    draftUrl?: string;
    onBeforeSubmit?: () => void;
    onSubmitSuccess?: () => void;
    onSubmitError?: (error: Error) => void;
}

export const useFormSubmit = (options: UseFormSubmitOptions) => {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const formRef = useRef<HTMLFormElement>(null);
    const {
        draftUrl,
        onBeforeSubmit,
        onSubmitSuccess,
        onSubmitError
    } = options;

    const validateForm = (data: FormSubmitData, isEdit = false) => {
        if (!data.title.trim()) {
            toast.error('제목을 입력해주세요.');
            return false;
        }

        if (!isEdit && !data.url.trim()) {
            toast.error('URL 주소를 입력해주세요.');
            return false;
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
        if (!validateForm(data, isEdit)) return;

        setIsSubmitting(true);
        try {
            const form = formRef.current;
            if (!form) return;

            onBeforeSubmit?.();

            addHiddenField(form, 'tag', data.tags.join(','));
            addHiddenField(form, 'series', data.seriesId);
            // Note: text_md is already added by TiptapEditor as a hidden input
            // We don't need to add it here to avoid overwriting the editor's value

            if (isDraft) {
                addHiddenField(form, 'is_draft', 'true');
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
