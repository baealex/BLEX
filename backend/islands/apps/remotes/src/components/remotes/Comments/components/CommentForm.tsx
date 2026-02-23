import { useRef, useEffect, useState } from 'react';
import { Lock, Loader2 } from '@blex/ui';
import { MentionAutocomplete } from './MentionAutocomplete';

interface CommentFormProps {
    isLoggedIn: boolean;
    commentText: string;
    onCommentTextChange: (text: string) => void;
    onSubmit: () => void;
    isSubmitting: boolean;
    onShowLoginPrompt: () => void;
    placeholder?: string;
    mentionableUsers?: string[];
    onCancel?: () => void;
    submitButtonText?: string;
}

export const CommentForm = ({
    isLoggedIn,
    commentText,
    onCommentTextChange,
    onSubmit,
    isSubmitting,
    onShowLoginPrompt,
    placeholder = '댓글을 작성해보세요...',
    mentionableUsers = [],
    onCancel,
    submitButtonText = '댓글 작성'
}: CommentFormProps) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [showMentionAutocomplete, setShowMentionAutocomplete] = useState(false);
    const [mentionQuery, setMentionQuery] = useState('');
    const [mentionStartPos, setMentionStartPos] = useState(0);
    const [selectedUserIndex, setSelectedUserIndex] = useState(0);

    useEffect(() => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        textarea.style.height = 'auto';
        textarea.style.height = `${textarea.scrollHeight}px`;
    }, [commentText]);

    // 멘션 자동완성을 위한 사용자 필터링
    const filteredUsers = mentionQuery
        ? mentionableUsers.filter(user =>
            user.toLowerCase().includes(mentionQuery.toLowerCase())
        )
        : mentionableUsers;

    // 텍스트 변경 감지 및 멘션 자동완성 트리거
    // 텍스트 변경 감지 및 멘션 자동완성 트리거
    const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newText = e.target.value;
        const cursorPos = e.target.selectionStart;

        onCommentTextChange(newText);

        // @ 기호 감지
        const textBeforeCursor = newText.substring(0, cursorPos);
        const lastAtIndex = textBeforeCursor.lastIndexOf('@');

        if (lastAtIndex !== -1) {
            const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);
            // @ 뒤에 공백이 없고, 알파벳/숫자/점만 있으면 자동완성 표시
            if (/^[a-zA-Z0-9.]*$/.test(textAfterAt)) {
                setMentionQuery(textAfterAt);
                setMentionStartPos(lastAtIndex);
                setShowMentionAutocomplete(true);
                setSelectedUserIndex(0);
            } else {
                setShowMentionAutocomplete(false);
            }
        } else {
            setShowMentionAutocomplete(false);
        }
    };

    // 사용자 선택
    const selectUser = (username: string) => {
        const before = commentText.substring(0, mentionStartPos);
        const after = commentText.substring(textareaRef.current?.selectionStart || commentText.length);
        const newText = `${before}\`@${username}\` ${after}`;

        onCommentTextChange(newText);
        setShowMentionAutocomplete(false);

        // 커서 위치 조정
        setTimeout(() => {
            const newCursorPos = before.length + username.length + 4; // ` + @ + username + ` + space
            textareaRef.current?.setSelectionRange(newCursorPos, newCursorPos);
            textareaRef.current?.focus();
        }, 0);
    };

    // 키보드 이벤트 처리
    // 키보드 이벤트 처리
    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (!showMentionAutocomplete || filteredUsers.length === 0) return;

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setSelectedUserIndex(prev =>
                    prev < filteredUsers.length - 1 ? prev + 1 : 0
                );
                break;
            case 'ArrowUp':
                e.preventDefault();
                setSelectedUserIndex(prev =>
                    prev > 0 ? prev - 1 : filteredUsers.length - 1
                );
                break;
            case 'Enter':
                if (showMentionAutocomplete) {
                    e.preventDefault();
                    selectUser(filteredUsers[selectedUserIndex]);
                }
                break;
            case 'Escape':
                e.preventDefault();
                setShowMentionAutocomplete(false);
                break;
        }
    };

    if (!isLoggedIn) {
        return (
            <div className="relative group cursor-pointer rounded-xl overflow-hidden" onClick={onShowLoginPrompt}>
                <textarea
                    className="w-full p-5 border border-line rounded-xl resize-none bg-surface-subtle text-sm placeholder-content-hint pointer-events-none"
                    placeholder={placeholder}
                    rows={3}
                    disabled
                    aria-hidden="true"
                />

                {/* Hover 시 나타나는 안내 */}
                <div className="absolute inset-0 flex items-center justify-center bg-surface/0 group-hover:bg-surface/90 transition-all duration-200 pointer-events-none">
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center gap-2">
                        <Lock className="w-5 h-5 text-content-secondary" />
                        <span className="text-sm font-semibold text-content">로그인이 필요합니다</span>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            <div className="relative">
                <textarea
                    ref={textareaRef}
                    className="w-full p-5 border-2 border-line focus:border-line-strong focus:outline-none focus:ring-2 focus:ring-line/10 rounded-xl resize-none bg-surface text-sm placeholder-content-hint leading-relaxed transition-all duration-150"
                    value={commentText}
                    onChange={handleTextChange}
                    onKeyDown={handleKeyDown}
                    disabled={isSubmitting}
                    placeholder={placeholder}
                    rows={3}
                    aria-label="댓글 내용"
                />

                {/* 멘션 자동완성 */}
                <MentionAutocomplete
                    users={filteredUsers}
                    open={showMentionAutocomplete && filteredUsers.length > 0}
                    selectedIndex={selectedUserIndex}
                    onSelectedIndexChange={setSelectedUserIndex}
                    onSelect={selectUser}
                    onClose={() => setShowMentionAutocomplete(false)}
                    anchorEl={textareaRef.current}
                />
            </div>

            <div className="flex justify-end gap-2">
                {onCancel && (
                    <button
                        className="px-5 py-2.5 rounded-lg text-sm text-content hover:text-content hover:bg-surface-subtle font-semibold disabled:opacity-50 transition-all duration-150"
                        onClick={onCancel}
                        disabled={isSubmitting}>
                        취소
                    </button>
                )}
                <button
                    className="px-6 py-2.5 rounded-lg bg-action hover:bg-action-hover disabled:bg-line disabled:text-content-hint text-content-inverted text-sm font-semibold disabled:cursor-not-allowed transition-all duration-150 shadow-sm hover:shadow-md"
                    onClick={onSubmit}
                    disabled={isSubmitting || !commentText.trim()}
                    aria-label={isSubmitting ? '댓글 작성 중' : '댓글 작성하기'}>
                    {isSubmitting ? (
                        <span className="inline-flex items-center gap-2">
                            <Loader2 className="animate-spin w-4 h-4" />
                            작성 중...
                        </span>
                    ) : (
                        submitButtonText
                    )}
                </button>
            </div>
        </div>
    );
};
