import { useState, useEffect } from 'react';
import { logger } from '~/utils/logger';
import {
    Dialog,
    IconButton,
    X,
    AlertTriangle,
    FileText,
    Clock
} from '@blex/ui';
import { getDrafts, type DraftSummary } from '~/lib/api/posts';
import { cx } from '~/lib/classnames';

const formatRelativeTime = (dateString: string): string => {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMinutes < 1) return '방금 전';
    if (diffMinutes < 60) return `${diffMinutes}분 전`;
    if (diffHours < 24) return `${diffHours}시간 전`;
    if (diffDays < 7) return `${diffDays}일 전`;

    return date.toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
};

interface DraftsPanelProps {
    isOpen: boolean;
    onClose: () => void;
    onSelectPost: (url: string) => void;
    currentDraftUrl?: string;
}

const DraftsPanel = ({
    isOpen,
    onClose,
    onSelectPost,
    currentDraftUrl
}: DraftsPanelProps) => {
    const [drafts, setDrafts] = useState<DraftSummary[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [hasError, setHasError] = useState(false);

    useEffect(() => {
        if (isOpen) {
            fetchDrafts();
        }
    }, [isOpen]);

    const fetchDrafts = async () => {
        setIsLoading(true);
        setHasError(false);
        try {
            const { data } = await getDrafts();
            if (data.status === 'DONE' && data.body?.drafts) {
                setDrafts(Array.isArray(data.body.drafts) ? data.body.drafts : []);
            } else {
                setDrafts([]);
            }
        } catch (error) {
            logger.error('Failed to fetch drafts:', error);
            setHasError(true);
            setDrafts([]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <Dialog.Portal>
                {/* Backdrop */}
                <Dialog.Overlay className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />

                {/* Slide-over panel */}
                <Dialog.Content
                    className={cx(
                        'fixed inset-y-0 left-0 z-50 w-full sm:w-[480px] bg-white shadow-2xl flex flex-col focus:outline-none',
                        'data-[state=open]:animate-in data-[state=closed]:animate-out',
                        'data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left',
                        'duration-300 ease-in-out'
                    )}>

                    {/* Header */}
                    <div className="flex items-center justify-between p-5 border-b border-gray-200">
                        <Dialog.Title className="text-lg font-semibold text-gray-900">임시 저장 글</Dialog.Title>
                        <Dialog.Close asChild>
                            <IconButton aria-label="닫기">
                                <X className="w-5 h-5" />
                            </IconButton>
                        </Dialog.Close>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto">
                        {isLoading ? (
                            <div className="flex items-center justify-center flex-1 min-h-[200px]">
                                <div className="w-6 h-6 border-2 border-gray-200 border-t-gray-600 rounded-full animate-spin" />
                            </div>
                        ) : hasError ? (
                            <div className="flex flex-col items-center justify-center flex-1 min-h-[200px] text-gray-500 px-6">
                                <AlertTriangle className="w-12 h-12 mb-3 text-gray-300" />
                                <p className="text-sm mb-3">임시 글 목록을 불러오지 못했습니다</p>
                                <button
                                    type="button"
                                    onClick={fetchDrafts}
                                    className="text-sm text-blue-600 hover:text-blue-800 font-medium">
                                    다시 시도
                                </button>
                            </div>
                        ) : drafts.length === 0 ? (
                            <div className="flex flex-col items-center justify-center flex-1 min-h-[200px] text-gray-500">
                                <FileText className="w-12 h-12 mb-3 text-gray-300" />
                                <p className="text-sm">임시 저장된 글이 없습니다</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-gray-100">
                                {drafts.map((draft) => (
                                    <button
                                        key={draft.url}
                                        onClick={() => onSelectPost(draft.url)}
                                        className={cx(
                                            'w-full text-left p-4 hover:bg-gray-50 transition-colors',
                                            draft.url === currentDraftUrl && 'bg-blue-50 border-l-4 border-blue-500'
                                        )}>
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex-1 min-w-0">
                                                <h3 className="text-sm font-medium text-gray-900 truncate mb-1">
                                                    {draft.title || '제목 없음'}
                                                </h3>
                                                <p className="text-xs text-gray-400 flex items-center gap-1">
                                                    <Clock className="w-3 h-3" />
                                                    <span title={draft.createdDate}>{formatRelativeTime(draft.createdDate)}</span>
                                                </p>
                                            </div>
                                            {draft.url === currentDraftUrl && (
                                                <div className="flex-shrink-0">
                                                    <div className="w-2 h-2 bg-blue-500 rounded-full" />
                                                </div>
                                            )}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="p-4 border-t border-gray-200 bg-gray-50">
                        <p className="text-xs text-gray-500 text-center">
                            총 {drafts.length}개의 임시 저장 글
                        </p>
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
};

export default DraftsPanel;
