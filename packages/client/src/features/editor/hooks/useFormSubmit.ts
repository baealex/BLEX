import { useRef, useState } from 'react';
import { useLingui } from '@lingui/react/macro';
import { publishPost } from '~/lib/api/posts';
import { toast } from '~/utils/toast';
import { hasPublishableContent } from '../utils/publishChecklist';
import { submitPublish, type PublishFields } from '../utils/publishSubmission';
import { isFutureScheduleDate, parseScheduleDate } from '../utils/scheduleDate';

interface UseFormSubmitOptions {
    settleDraft: () => Promise<string | undefined>;
    onPublished: (postUrl: string) => void;
    onRejected: () => void;
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

export const useFormSubmit = ({ settleDraft, onPublished, onRejected }: UseFormSubmitOptions) => {
    const { t } = useLingui();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const formRef = useRef<HTMLFormElement>(null);
    const isSubmitLockedRef = useRef(false);

    const validateForm = (data: PublishFields) => {
        if (!data.title.trim()) {
            toast.error(
                t({
                    id: 'editor.validation.title_required',
                    message: 'Enter a title.'
                })
            );
            return false;
        }

        if (!hasPublishableContent(data.content)) {
            toast.error(
                t({
                    id: 'editor.validation.content_required',
                    message: 'Add some content.'
                })
            );
            return false;
        }

        if (!normalizeUrlForSubmit(data.url)) {
            toast.error(
                t({
                    id: 'editor.validation.url_required',
                    message: 'Enter a post URL.'
                })
            );
            return false;
        }

        if (data.reservedDate) {
            if (!parseScheduleDate(data.reservedDate)) {
                toast.error(
                    t({
                        id: 'editor.validation.schedule_invalid',
                        message: 'Check the scheduled time.'
                    })
                );
                return false;
            }

            if (!isFutureScheduleDate(data.reservedDate)) {
                toast.error(
                    t({
                        id: 'editor.validation.schedule_future',
                        message: 'Choose a scheduled time in the future.'
                    })
                );
                return false;
            }
        }

        return true;
    };

    const submitForm = async (data: PublishFields) => {
        const form = formRef.current;
        if (!form || isSubmitLockedRef.current || !validateForm(data)) return;

        isSubmitLockedRef.current = true;
        setIsSubmitting(true);
        await submitPublish({
            readForm: () => new FormData(form),
            fields: {
                ...data,
                url: normalizeUrlForSubmit(data.url)
            },
            settleDraft,
            send: publishPost,
            fallbackError: t({
                id: 'editor.error.save',
                message: 'Could not save the post.'
            }),
            onPublished,
            onRejected: (message) => {
                isSubmitLockedRef.current = false;
                setIsSubmitting(false);
                onRejected();
                toast.error(message);
            }
        });
    };

    return {
        formRef,
        isSubmitting,
        submitForm
    };
};
