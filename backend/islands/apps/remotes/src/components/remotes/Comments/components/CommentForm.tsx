import { useRef, useEffect, useState } from 'react';
import { Trans, useLingui } from '@lingui/react/macro';
import { Loader2, Lock } from '@blex/ui/icons';
import { MentionAutocomplete } from './MentionAutocomplete';
import { isMentionQuery, isMentionStart } from '../utils/mentionText';

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
    placeholder,
    mentionableUsers = [],
    onCancel,
    submitButtonText
}: CommentFormProps) => {
    const { t } = useLingui();
    const resolvedPlaceholder = placeholder ?? t({
        id: 'comments.form.placeholder',
        message: 'Write a comment...'
    });
    const resolvedSubmitButtonText = submitButtonText ?? t({
        id: 'comments.form.submit',
        message: 'Post comment'
    });
    const loginRequiredLabel = t({
        id: 'comments.login_required',
        message: 'Log in to comment'
    });
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
            if (isMentionStart(textBeforeCursor, lastAtIndex) && isMentionQuery(textAfterAt)) {
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
        const newText = `${before}@${username} ${after}`;

        onCommentTextChange(newText);
        setShowMentionAutocomplete(false);

        // 커서 위치 조정
        setTimeout(() => {
            const newCursorPos = before.length + username.length + 2; // @ + username + space
            textareaRef.current?.setSelectionRange(newCursorPos, newCursorPos);
            textareaRef.current?.focus();
        }, 0);
    };

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
            <button
                type="button"
                onClick={onShowLoginPrompt}
                aria-label={loginRequiredLabel}
                className="group flex min-h-28 w-full cursor-pointer flex-col items-start justify-between gap-4 rounded-xl border border-line bg-surface-subtle p-5 text-left transition-all duration-150 hover:border-line-strong hover:bg-surface focus:outline-none focus:ring-2 focus:ring-action/20">
                <span aria-hidden="true" className="text-sm text-content-hint">
                    {resolvedPlaceholder}
                </span>
                <span className="inline-flex items-center gap-2 text-sm font-semibold text-content-secondary transition-colors group-hover:text-content">
                    <Lock aria-hidden="true" className="h-4 w-4" />
                    {loginRequiredLabel}
                </span>
            </button>
        );
    }

    return (
        <div className="space-y-3">
            <div className="relative">
                <textarea
                    ref={textareaRef}
                    className="w-full p-5 border border-line focus:border-line-strong focus:outline-none focus:ring-2 focus:ring-line/10 rounded-xl resize-none bg-surface text-sm placeholder-content-hint leading-relaxed transition-all duration-150"
                    value={commentText}
                    onChange={handleTextChange}
                    onKeyDown={handleKeyDown}
                    disabled={isSubmitting}
                    placeholder={resolvedPlaceholder}
                    rows={3}
                    aria-label={t({
                        id: 'comments.form.content_label',
                        message: 'Comment content'
                    })}
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
                        <Trans id="common.cancel">Cancel</Trans>
                    </button>
                )}
                <button
                    className="px-6 py-2.5 rounded-lg bg-action hover:bg-action-hover disabled:bg-line disabled:text-content-hint text-content-inverted text-sm font-semibold disabled:cursor-not-allowed transition-all duration-150 shadow-sm hover:shadow-md"
                    onClick={onSubmit}
                    disabled={isSubmitting || !commentText.trim()}
                    aria-label={isSubmitting
                        ? t({
                            id: 'comments.form.submitting_label',
                            message: 'Posting comment'
                        })
                        : t({
                            id: 'comments.form.submit_label',
                            message: 'Post comment'
                        })}>
                    {isSubmitting ? (
                        <span className="inline-flex items-center gap-2">
                            <Loader2 className="animate-spin w-4 h-4" />
                            <Trans id="comments.form.submitting">Posting...</Trans>
                        </span>
                    ) : (
                        resolvedSubmitButtonText
                    )}
                </button>
            </div>
        </div>
    );
};
