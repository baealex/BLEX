import { useEffect, useState } from 'react';
import { Trans, useLingui } from '@lingui/react/macro';
import {
    Calendar,
    Check,
    FileText,
    Loader2,
    Search
} from '@blex/ui/icons';
import { Input, Modal } from '~/components/shared';
import { getMediaPath } from '~/modules/static.module';
import type { PinnablePostData, PinnablePostsPaginationData } from '~/lib/api/settings';
import { PinnablePostsPager } from './PinnablePostsPager';
import { formatPublishedDate } from '~/i18n/formatters';
import { normalizeLocale } from '~/i18n/locale';

interface AddPinnedPostModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    pinnablePosts: PinnablePostData[];
    searchQuery?: string;
    onSearchQueryChange?: (query: string) => void;
    pagination: PinnablePostsPaginationData;
    onPageChange: (page: number) => void;
    onAdd: (postUrl: string) => void;
    isLoading: boolean;
    isFetchingPosts?: boolean;
    presentation?: 'modal' | 'inline';
}

export const AddPinnedPostModal = ({
    open,
    onOpenChange,
    pinnablePosts,
    searchQuery = '',
    onSearchQueryChange,
    pagination,
    onPageChange,
    onAdd,
    isLoading,
    isFetchingPosts = false,
    presentation = 'modal'
}: AddPinnedPostModalProps) => {
    const { i18n, t } = useLingui();
    const locale = normalizeLocale(i18n.locale);
    const [selectedPost, setSelectedPost] = useState<string | null>(null);

    useEffect(() => {
        setSelectedPost(null);
    }, [searchQuery]);

    const handleAdd = () => {
        if (selectedPost) {
            onAdd(selectedPost);
            setSelectedPost(null);
            onSearchQueryChange?.('');
        }
    };

    const handleClose = () => {
        onOpenChange(false);
        setSelectedPost(null);
        onSearchQueryChange?.('');
    };

    const handlePageChange = (page: number) => {
        setSelectedPost(null);
        onPageChange(page);
    };

    const content = (
        <div className={`flex flex-col ${presentation === 'inline' ? 'max-h-[68vh] rounded-2xl border border-line bg-surface-elevated shadow-subtle' : 'h-[70vh]'}`}>
            {presentation === 'inline' && (
                <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
                    <div className="space-y-1">
                        <h3 className="text-base font-semibold text-content">
                            <Trans id="settings.pinned_posts.select.title">Select a post to pin</Trans>
                        </h3>
                        <p className="text-sm text-content-secondary">
                            <Trans id="settings.pinned_posts.select.description">Choose a post to feature on your profile.</Trans>
                        </p>
                    </div>
                    <div>
                        <button
                            type="button"
                            onClick={handleClose}
                            className="inline-flex min-h-11 items-center justify-center rounded-lg px-3 text-sm font-semibold text-content-secondary transition-colors duration-150 hover:bg-surface-subtle hover:text-content active:scale-95 [@media(pointer:fine)]:min-h-9">
                            <Trans id="settings.pinned_posts.select.cancel_selection">Cancel selection</Trans>
                        </button>
                    </div>
                </div>
            )}

            <div className={`space-y-3 border-b border-line ${presentation === 'inline' ? 'px-5 py-4' : 'px-6 py-4'}`}>
                {presentation === 'modal' && (
                    <p className="text-sm text-content-secondary">
                        <Trans id="settings.pinned_posts.select.modal_description">Choose a post to display on your profile.</Trans>
                    </p>
                )}
                <Input
                    type="search"
                    density="compact"
                    aria-label={t({
                        id: 'settings.pinned_posts.select.search_label',
                        message: 'Search posts to pin'
                    })}
                    placeholder={t({
                        id: 'settings.pinned_posts.select.search_placeholder',
                        message: 'Search by post title...'
                    })}
                    value={searchQuery}
                    onChange={(e) => onSearchQueryChange?.(e.target.value)}
                    leftIcon={<Search aria-hidden className="h-4 w-4" />}
                />
            </div>

            <div className={`flex-1 overflow-y-auto bg-surface-subtle/30 ${presentation === 'inline' ? 'min-h-0 px-4 py-4' : 'p-4'}`}>
                {isFetchingPosts && pinnablePosts.length === 0 ? (
                    <div className="grid grid-cols-1 gap-2">
                        {Array.from({ length: 4 }).map((_, index) => (
                            <div
                                key={index}
                                className="animate-pulse rounded-xl border border-line bg-surface p-4">
                                <div className="flex items-center gap-4">
                                    <div className="h-16 w-16 rounded-lg bg-surface-subtle" />
                                    <div className="min-w-0 flex-1 space-y-2">
                                        <div className="h-5 w-2/3 rounded bg-surface-subtle" />
                                        <div className="h-4 w-1/3 rounded bg-surface-subtle" />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : pinnablePosts.length === 0 ? (
                    <div className="flex h-full flex-col items-center justify-center py-12 text-center">
                        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-surface-subtle">
                            <Search aria-hidden className="h-5 w-5 text-content-hint" />
                        </div>
                        <p className="mb-1 text-base font-medium text-content">
                            <Trans id="settings.pinned_posts.select.empty_title">No search results</Trans>
                        </p>
                        <p className="text-sm text-content-secondary">
                            <Trans id="settings.pinned_posts.select.empty_description">Try another search term.</Trans>
                        </p>
                    </div>
                ) : (
                    <div
                        className="grid grid-cols-1 gap-2"
                        role="radiogroup"
                        aria-label={t({
                            id: 'settings.pinned_posts.select.group_label',
                            message: 'Select a post to pin'
                        })}>
                        {pinnablePosts.map((post) => {
                            const isSelected = selectedPost === post.url;
                            return (
                                <button
                                    key={post.url}
                                    type="button"
                                    role="radio"
                                    aria-checked={isSelected}
                                    aria-label={i18n._({
                                        id: 'settings.pinned_posts.select.post_label',
                                        message: 'Select post to pin: {title}',
                                        values: { title: post.title }
                                    })}
                                    onClick={() => setSelectedPost(post.url)}
                                    className={`group relative flex w-full items-center gap-4 rounded-xl border p-4 text-left transition-all duration-150 active:scale-[0.99] ${
                                        isSelected
                                            ? 'z-10 border-line-strong bg-surface shadow-subtle ring-1 ring-line-strong'
                                            : 'border-line bg-surface hover:border-line-strong hover:shadow-subtle'
                                    }`}>

                                    {post.image ? (
                                        <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg border border-line bg-surface-subtle">
                                            <img
                                                src={getMediaPath(post.image)}
                                                alt={post.title}
                                                className="h-full w-full object-cover"
                                            />
                                        </div>
                                    ) : (
                                        <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-lg border border-line bg-surface-subtle text-content-hint">
                                            <FileText aria-hidden className="h-5 w-5" />
                                        </div>
                                    )}

                                    <div className="min-w-0 flex-1">
                                        <h4 className="mb-1 truncate text-base font-semibold text-content">
                                            {post.title}
                                        </h4>
                                        <p className="flex items-center gap-2 text-sm text-content-secondary">
                                            <Calendar aria-hidden className="h-4 w-4" />
                                            {formatPublishedDate(post.createdDate, post.createdDate, locale)}
                                        </p>
                                    </div>

                                    <div
                                        className={`absolute right-4 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full border transition-all ${
                                        isSelected
                                            ? 'scale-100 border-line-strong bg-action text-content-inverted opacity-100'
                                            : 'border-line bg-surface text-transparent group-hover:border-line-strong'
                                    }`}>
                                        <Check aria-hidden className="h-3.5 w-3.5" />
                                    </div>
                                </button>
                            );
                        })}
                        <PinnablePostsPager
                            pagination={pagination}
                            onPageChange={handlePageChange}
                            isLoading={isFetchingPosts}
                        />
                    </div>
                )}
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-line bg-surface-subtle px-6 py-4">
                <Modal.FooterAction variant="secondary" onClick={handleClose}>
                    <Trans id="common.cancel">Cancel</Trans>
                </Modal.FooterAction>
                <Modal.FooterAction
                    variant="primary"
                    onClick={handleAdd}
                    disabled={!selectedPost || isLoading}>
                    {isLoading ? (
                        <span className="flex items-center gap-2">
                            <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
                            <Trans id="settings.pinned_posts.select.adding">Adding...</Trans>
                        </span>
                    ) : (
                        <Trans id="settings.pinned_posts.select.pin">Pin post</Trans>
                    )}
                </Modal.FooterAction>
            </div>
        </div>
    );

    if (presentation === 'inline' && !open) {
        return null;
    }

    if (presentation === 'inline') {
        return content;
    }

    return (
        <Modal
            isOpen={open}
            onClose={handleClose}
            title={t({
                id: 'settings.pinned_posts.select.modal_title',
                message: 'Pin a post'
            })}
            maxWidth="2xl">
            {content}
        </Modal>
    );
};
