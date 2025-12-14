import React, { useState, useEffect } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { getTempPosts, type TempPost } from '~/lib/api/settings';
import { cx } from '~/lib/classnames';

interface TempPostsPanelProps {
    isOpen: boolean;
    onClose: () => void;
    onSelectPost: (token: string) => void;
    currentToken?: string;
}

const TempPostsPanel: React.FC<TempPostsPanelProps> = ({
    isOpen,
    onClose,
    onSelectPost,
    currentToken
}) => {
    const [tempPosts, setTempPosts] = useState<TempPost[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            fetchTempPosts();
        }
    }, [isOpen]);

    const fetchTempPosts = async () => {
        setIsLoading(true);
        try {
            const { data } = await getTempPosts();
            if (data.status === 'DONE' && data.body?.temps) {
                setTempPosts(Array.isArray(data.body.temps) ? data.body.temps : []);
            } else {
                setTempPosts([]);
            }
        } catch (error) {
            console.error('Failed to fetch temp posts:', error);
            setTempPosts([]);
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
                            <button
                                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                                aria-label="닫기">
                                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </Dialog.Close>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto">
                        {isLoading ? (
                            <div className="flex items-center justify-center h-32">
                                <div className="w-6 h-6 border-2 border-gray-200 border-t-gray-600 rounded-full animate-spin" />
                            </div>
                        ) : tempPosts.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-32 text-gray-500">
                                <svg className="w-12 h-12 mb-2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                <p className="text-sm">임시 저장된 글이 없습니다</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-gray-100">
                                {[...tempPosts].reverse().map((post) => (
                                    <button
                                        key={post.token}
                                        onClick={() => onSelectPost(post.token)}
                                        className={`w-full text-left p-4 hover:bg-gray-50 transition-colors ${
                                            post.token === currentToken ? 'bg-blue-50 border-l-4 border-blue-500' : ''
                                        }`}>
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex-1 min-w-0">
                                                <h3 className="text-sm font-medium text-gray-900 truncate mb-1">
                                                    {post.title || '제목 없음'}
                                                </h3>
                                                <p className="text-xs text-gray-400">
                                                    {post.createdDate}
                                                </p>
                                            </div>
                                            {post.token === currentToken && (
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
                            총 {tempPosts.length}개의 임시 저장 글
                        </p>
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
};

export default TempPostsPanel;
