import { useRef, useEffect, useState, useCallback } from 'react';
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
    const handleTextChange = useCallback(
        (e: React.ChangeEvent<HTMLTextAreaElement>) => {
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
        },
        [onCommentTextChange]
    );

    // 사용자 선택
    const selectUser = useCallback(
        (username: string) => {
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
        },
        [commentText, mentionStartPos, onCommentTextChange]
    );

    // 키보드 이벤트 처리
    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
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
        },
        [showMentionAutocomplete, filteredUsers, selectedUserIndex, selectUser]
    );

    if (!isLoggedIn) {
        return (
            <div className="relative group cursor-pointer rounded-xl overflow-hidden" onClick={onShowLoginPrompt}>
                <textarea
                    className="w-full p-5 border border-gray-200 rounded-xl resize-none bg-gray-50 text-sm placeholder-gray-400 pointer-events-none"
                    placeholder={placeholder}
                    rows={3}
                    disabled
                    aria-hidden="true"
                />

                {/* Hover 시 나타나는 안내 */}
                <div className="absolute inset-0 flex items-center justify-center bg-white/0 group-hover:bg-white/90 transition-all duration-200 pointer-events-none">
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center gap-2">
                        <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                        <span className="text-sm font-semibold text-gray-900">로그인이 필요합니다</span>
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
                    className="w-full p-5 border-2 border-gray-200 focus:border-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/10 rounded-xl resize-none bg-white text-sm placeholder-gray-400 leading-relaxed transition-all duration-150"
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
                        className="px-5 py-2.5 rounded-lg text-sm text-gray-700 hover:text-gray-900 hover:bg-gray-100 font-semibold disabled:opacity-50 transition-all duration-150"
                        onClick={onCancel}
                        disabled={isSubmitting}>
                        취소
                    </button>
                )}
                <button
                    className="px-6 py-2.5 rounded-lg bg-gray-900 hover:bg-gray-800 disabled:bg-gray-200 disabled:text-gray-400 text-white text-sm font-semibold disabled:cursor-not-allowed transition-all duration-150 shadow-sm hover:shadow-md"
                    onClick={onSubmit}
                    disabled={isSubmitting || !commentText.trim()}
                    aria-label={isSubmitting ? '댓글 작성 중' : '댓글 작성하기'}>
                    {isSubmitting ? (
                        <span className="inline-flex items-center gap-2">
                            <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                                <circle
                                    className="opacity-25"
                                    cx="12"
                                    cy="12"
                                    r="10"
                                    stroke="currentColor"
                                    strokeWidth="4"
                                />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
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
