import { useRef, useEffect } from 'react';
import { Trans, useLingui } from '@lingui/react/macro';
import { Loader2 } from '@blex/ui/icons';

interface CommentEditFormProps {
    editText: string;
    onEditTextChange: (text: string) => void;
    onSave: () => void;
    onCancel: () => void;
    isSubmitting: boolean;
}

export const CommentEditForm = ({
    editText,
    onEditTextChange,
    onSave,
    onCancel,
    isSubmitting
}: CommentEditFormProps) => {
    const { t } = useLingui();
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        textarea.focus();
        textarea.style.height = 'auto';
        textarea.style.height = `${textarea.scrollHeight}px`;
    }, []);

    useEffect(() => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        textarea.style.height = 'auto';
        textarea.style.height = `${textarea.scrollHeight}px`;
    }, [editText]);

    return (
        <div className="space-y-3 bg-surface-subtle p-4 rounded-xl border border-line">
            <div className="relative">
                <textarea
                    ref={textareaRef}
                    className="w-full p-5 border-2 border-line focus:border-line-strong focus:outline-none focus:ring-2 focus:ring-line/10 rounded-xl resize-none bg-surface text-sm placeholder-content-hint leading-relaxed transition-all duration-150"
                    value={editText}
                    onChange={(e) => onEditTextChange(e.target.value)}
                    placeholder={t({
                        id: 'comments.edit.placeholder',
                        message: 'Edit your comment...'
                    })}
                    disabled={isSubmitting}
                    rows={3}
                    aria-label={t({
                        id: 'comments.edit.content_label',
                        message: 'Edited comment content'
                    })}
                />
            </div>
            <div className="flex gap-2 justify-end">
                <button
                    className="px-5 py-2.5 rounded-lg text-sm text-content hover:text-content hover:bg-line font-semibold disabled:opacity-50 transition-all duration-150"
                    onClick={onCancel}
                    disabled={isSubmitting}
                    aria-label={t({
                        id: 'comments.edit.cancel',
                        message: 'Cancel editing'
                    })}>
                    <Trans id="common.cancel">Cancel</Trans>
                </button>
                <button
                    className="px-6 py-2.5 rounded-lg bg-action hover:bg-action-hover disabled:bg-line disabled:text-content-hint text-content-inverted text-sm font-semibold disabled:cursor-not-allowed transition-all duration-150 shadow-sm hover:shadow-md"
                    onClick={onSave}
                    disabled={isSubmitting || !editText.trim()}
                    aria-label={isSubmitting
                        ? t({
                            id: 'common.saving',
                            message: 'Saving'
                        })
                        : t({
                            id: 'comments.edit.save',
                            message: 'Save comment'
                        })}>
                    {isSubmitting ? (
                        <span className="inline-flex items-center gap-2">
                            <Loader2 className="animate-spin w-4 h-4" />
                            <Trans id="common.saving_ellipsis">Saving...</Trans>
                        </span>
                    ) : (
                        <Trans id="common.save">Save</Trans>
                    )}
                </button>
            </div>
        </div>
    );
};
