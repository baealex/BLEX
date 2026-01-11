import { useRef, useEffect } from 'react';

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
        <div className="space-y-3">
            <div className="relative">
                <textarea
                    ref={textareaRef}
                    className="w-full p-4 border border-gray-200 focus:border-gray-900 focus:outline-none resize-none bg-white text-sm placeholder-gray-400 leading-relaxed"
                    value={editText}
                    onChange={(e) => onEditTextChange(e.target.value)}
                    placeholder="댓글을 수정하세요..."
                    disabled={isSubmitting}
                    rows={3}
                    aria-label="댓글 수정 내용"
                />
            </div>
            <div className="flex gap-2 justify-end">
                <button
                    className="px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={onSave}
                    disabled={isSubmitting || !editText.trim()}
                    aria-label={isSubmitting ? '저장 중' : '댓글 저장'}>
                    {isSubmitting ? '저장 중...' : '저장'}
                </button>
                <button
                    className="px-4 py-2 text-gray-600 hover:text-gray-900 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={onCancel}
                    disabled={isSubmitting}
                    aria-label="수정 취소">
                    취소
                </button>
            </div>
        </div>
    );
};
