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
}

export const CommentForm = ({
    isLoggedIn,
    commentText,
    onCommentTextChange,
    onSubmit,
    isSubmitting,
    onShowLoginPrompt,
    placeholder = '댓글을 작성해보세요...',
    mentionableUsers = []
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
            <div className="relative group cursor-pointer" onClick={onShowLoginPrompt}>
                <textarea
                    className="w-full p-5 border border-gray-200 rounded-2xl resize-none bg-gray-50/50 text-sm placeholder-gray-400 pointer-events-none transition-all duration-200 group-hover:border-gray-300 group-hover:bg-white"
                    placeholder={placeholder}
                    rows={4}
                    disabled
                    aria-hidden="true"
                />

                {/* Hover 시 나타나는 안내 */}
                <div className="absolute inset-0 flex items-center justify-center bg-white/0 group-hover:bg-white/60 backdrop-blur-0 group-hover:backdrop-blur-sm transition-all duration-300 rounded-2xl pointer-events-none">
                    <div className="opacity-0 group-hover:opacity-100 transition-all duration-300 transform group-hover:translate-y-0 translate-y-2 text-center px-4">
                        <div className="inline-flex items-center gap-2 px-4 py-2 bg-black/80 text-white rounded-full text-sm font-medium shadow-lg backdrop-blur-md">
                            <i className="fas fa-lock text-xs" />
                            <span>로그인이 필요합니다</span>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="relative">
                <textarea
                    ref={textareaRef}
                    className="w-full p-5 border border-gray-200 rounded-2xl focus:ring-4 focus:ring-black/5 focus:border-black resize-none bg-white transition-all duration-200 placeholder-gray-400 text-sm hover:border-gray-300 leading-relaxed"
                    value={commentText}
                    onChange={handleTextChange}
                    onKeyDown={handleKeyDown}
                    disabled={isSubmitting}
                    placeholder={placeholder}
                    rows={4}
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

            <div className="flex justify-end">
                <button
                    className="px-6 py-2.5 bg-black hover:bg-gray-800 disabled:bg-gray-100 disabled:text-gray-400 text-white rounded-xl text-sm font-medium transition-all duration-200 disabled:cursor-not-allowed hover:-translate-y-0.5 active:scale-95"
                    onClick={onSubmit}
                    disabled={isSubmitting || !commentText.trim()}
                    aria-label={isSubmitting ? '댓글 작성 중' : '댓글 작성하기'}>
                    {isSubmitting ? (
                        <span className="flex items-center gap-2">
                            <i className="fas fa-spinner fa-spin text-xs" />
                            <span>작성 중...</span>
                        </span>
                    ) : '댓글 작성'}
                </button>
            </div>
        </div>
    );
};
