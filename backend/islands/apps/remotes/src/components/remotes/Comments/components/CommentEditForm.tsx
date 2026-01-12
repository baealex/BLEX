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
        <div className="space-y-3 bg-gray-50 p-4 rounded-xl border border-gray-200">
            <div className="relative">
                <textarea
                    ref={textareaRef}
                    className="w-full p-5 border-2 border-gray-200 focus:border-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/10 rounded-xl resize-none bg-white text-sm placeholder-gray-400 leading-relaxed transition-all duration-150"
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
                    className="px-5 py-2.5 rounded-lg text-sm text-gray-700 hover:text-gray-900 hover:bg-gray-200 font-semibold disabled:opacity-50 transition-all duration-150"
                    onClick={onCancel}
                    disabled={isSubmitting}
                    aria-label="수정 취소">
                    취소
                </button>
                <button
                    className="px-6 py-2.5 rounded-lg bg-gray-900 hover:bg-gray-800 disabled:bg-gray-200 disabled:text-gray-400 text-white text-sm font-semibold disabled:cursor-not-allowed transition-all duration-150 shadow-sm hover:shadow-md"
                    onClick={onSave}
                    disabled={isSubmitting || !editText.trim()}
                    aria-label={isSubmitting ? '저장 중' : '댓글 저장'}>
                    {isSubmitting ? (
                        <span className="inline-flex items-center gap-2">
                            <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            저장 중...
                        </span>
                    ) : (
                        '저장'
                    )}
                </button>
            </div>
        </div>
    );
};
