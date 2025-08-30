import { useState, useCallback, useRef } from 'react';
import { notification } from '@baejino/ui';

interface FormSubmitData {
    title: string;
    url: string;
    content: string;
    tags: string[];
    seriesId: string;
}

interface UseFormSubmitOptions {
    getCsrfToken: () => string;
    tempToken?: string;
    onBeforeSubmit?: () => void;
    onSubmitSuccess?: () => void;
    onSubmitError?: (error: Error) => void;
}

export const useFormSubmit = (options: UseFormSubmitOptions) => {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const formRef = useRef<HTMLFormElement>(null);
    const {
        tempToken,
        onBeforeSubmit,
        onSubmitSuccess,
        onSubmitError
    } = options;

    const validateForm = useCallback((data: FormSubmitData, isEdit = false) => {
        if (!data.title.trim()) {
            notification('제목을 입력해주세요.', { type: 'error' });
            return false;
        }

        if (!isEdit && !data.url.trim()) {
            notification('URL 주소를 입력해주세요.', { type: 'error' });
            return false;
        }

        return true;
    }, []);

    const addHiddenField = useCallback((form: HTMLFormElement, name: string, value: string) => {
        let field = form.querySelector(`input[name="${name}"]`) as HTMLInputElement;
        if (!field) {
            field = document.createElement('input');
            field.type = 'hidden';
            field.name = name;
            form.appendChild(field);
        }
        field.value = value;
    }, []);

    const submitForm = useCallback(async (data: FormSubmitData, isDraft = false, isEdit = false) => {
        if (!validateForm(data, isEdit)) return;

        setIsSubmitting(true);
        try {
            const form = formRef.current;
            if (!form) return;

            onBeforeSubmit?.();

            addHiddenField(form, 'tag', data.tags.join(','));
            addHiddenField(form, 'series', data.seriesId);
            addHiddenField(form, 'text_md', data.content);

            if (isDraft) {
                addHiddenField(form, 'is_draft', 'true');
            }

            // Handle temp token
            if (tempToken) {
                addHiddenField(form, 'token', tempToken);

                // Remove tempToken from URL when submitting the post
                const newUrl = new URL(window.location.href);
                newUrl.searchParams.delete('tempToken');
                window.history.replaceState({}, '', newUrl.toString());
            } else {
                // Get tempToken from URL if exists (for new posts)
                const urlParams = new URLSearchParams(window.location.search);
                const urlTempToken = urlParams.get('tempToken');
                if (urlTempToken) {
                    addHiddenField(form, 'token', urlTempToken);

                    const newUrl = new URL(window.location.href);
                    newUrl.searchParams.delete('tempToken');
                    window.history.replaceState({}, '', newUrl.toString());
                }
            }

            form.submit();
            onSubmitSuccess?.();
        } catch (error) {
            const errorMessage = isEdit ? '게시글 수정에 실패했습니다.' : '게시글 저장에 실패했습니다.';
            notification(errorMessage, { type: 'error' });
            onSubmitError?.(error as Error);
            setIsSubmitting(false);
        }
    }, [validateForm, addHiddenField, tempToken, onBeforeSubmit, onSubmitSuccess, onSubmitError]);

    const deletePost = useCallback(async () => {
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
        } catch (error) {
            notification('게시글 삭제에 실패했습니다.', { type: 'error' });
            onSubmitError?.(error as Error);
            setIsSubmitting(false);
        }
    }, [onSubmitError]);

    return {
        formRef,
        isSubmitting,
        submitForm,
        deletePost
    };
};
