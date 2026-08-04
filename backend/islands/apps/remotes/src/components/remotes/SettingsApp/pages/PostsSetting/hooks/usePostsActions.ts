import { useState } from 'react';
import { useLingui } from '@lingui/react/macro';
import { toast } from '~/utils/toast';
import { useConfirm } from '~/hooks/useConfirm';
import {
    togglePostVisibility,
    deletePost,
    updatePostTags,
    updatePostSeries
} from '~/lib/api/posts';
import {
    clearPostClassificationDraft,
    type Post
} from './usePostsData';

interface UsePostsActionsProps {
    username: string;
    posts: Post[];
    setPosts: React.Dispatch<React.SetStateAction<Post[]>>;
    refetch: () => void;
}

interface UsePostsActionsReturn {
    handleVisibilityToggle: (postUrl: string) => Promise<void>;
    handleDelete: (postUrl: string) => Promise<void>;
    handleTagChange: (postUrl: string, value: string) => void;
    handleTagSubmit: (postUrl: string) => Promise<void>;
    handleSeriesChange: (postUrl: string, value: string) => void;
    handleSeriesSubmit: (postUrl: string) => Promise<void>;
    savingTagPostUrls: ReadonlySet<string>;
    savingSeriesPostUrls: ReadonlySet<string>;
}

export const usePostsActions = ({
    username,
    posts,
    setPosts,
    refetch
}: UsePostsActionsProps): UsePostsActionsReturn => {
    const { t } = useLingui();
    const { confirm } = useConfirm();
    const [savingTagPostUrls, setSavingTagPostUrls] = useState<Set<string>>(new Set());
    const [savingSeriesPostUrls, setSavingSeriesPostUrls] = useState<Set<string>>(new Set());

    const handleVisibilityToggle = async (postUrl: string) => {
        try {
            const { data } = await togglePostVisibility(username, postUrl);

            if (data.status === 'DONE') {
                setPosts(prev => prev.map(post =>
                    post.url === postUrl
                        ? {
                            ...post,
                            isHide: data.body.isHide
                        }
                        : post
                ));
                toast.success(data.body.isHide
                    ? t({
                        id: 'settings.posts.visibility.changed_private',
                        message: 'Post is now private.'
                    })
                    : t({
                        id: 'settings.posts.visibility.changed_public',
                        message: 'Post is now public.'
                    }));
            } else {
                toast.error(data.errorMessage || t({
                    id: 'settings.posts.visibility.update_failed',
                    message: 'Could not update post visibility.'
                }));
            }
        } catch {
            toast.error(t({
                id: 'settings.posts.visibility.update_failed',
                message: 'Could not update post visibility.'
            }));
        }
    };

    const handleDelete = async (postUrl: string) => {
        const confirmed = await confirm({
            title: t({
                id: 'settings.posts.trash.move.title',
                message: 'Move to trash'
            }),
            message: t({
                id: 'settings.posts.trash.move.message',
                message: 'Move this post to the trash? You can restore it later.'
            }),
            confirmText: t({
                id: 'settings.posts.trash.move.confirm',
                message: 'Move to trash'
            }),
            variant: 'danger'
        });

        if (!confirmed) return;

        try {
            const { data } = await deletePost(username, postUrl);

            if (data.status === 'DONE') {
                clearPostClassificationDraft(username, postUrl);
                toast.success(t({
                    id: 'settings.posts.trash.move.success',
                    message: 'Post moved to trash.'
                }));
                refetch();
            } else {
                toast.error(data.errorMessage || t({
                    id: 'settings.posts.trash.move.failed',
                    message: 'Could not move the post to trash.'
                }));
            }
        } catch {
            toast.error(t({
                id: 'settings.posts.trash.move.failed',
                message: 'Could not move the post to trash.'
            }));
        }
    };

    const handleTagChange = (postUrl: string, value: string) => {
        setPosts(prev => prev.map(post => {
            if (post.url !== postUrl) return post;
            return {
                ...post,
                tag: value,
                hasTagChanged: post.persistedTag !== value
            };
        }));
    };

    const handleTagSubmit = async (postUrl: string) => {
        const post = posts.find(p => p.url === postUrl);
        if (!post || savingTagPostUrls.has(postUrl)) return;

        const submittedTag = post.tag;
        setSavingTagPostUrls(prev => new Set(prev).add(postUrl));

        try {
            const { data } = await updatePostTags(username, postUrl, submittedTag);

            if (data.status === 'DONE') {
                const persistedTag = data.body.tag || '';
                setPosts(prev => prev.map(currentPost => {
                    if (currentPost.url !== postUrl) return currentPost;

                    const tag = currentPost.tag === submittedTag
                        ? persistedTag
                        : currentPost.tag;

                    return {
                        ...currentPost,
                        tag,
                        persistedTag,
                        hasTagChanged: tag !== persistedTag
                    };
                }));
                toast.success(t({
                    id: 'settings.posts.tags.update_success',
                    message: 'Tags updated.'
                }));
            } else {
                toast.error(data.errorMessage || t({
                    id: 'settings.posts.tags.update_failed',
                    message: 'Could not update tags.'
                }));
            }
        } catch {
            toast.error(t({
                id: 'settings.posts.tags.update_failed',
                message: 'Could not update tags.'
            }));
        } finally {
            setSavingTagPostUrls(prev => {
                const next = new Set(prev);
                next.delete(postUrl);
                return next;
            });
        }
    };

    const handleSeriesChange = (postUrl: string, value: string) => {
        setPosts(prev => prev.map(post => {
            if (post.url !== postUrl) return post;
            return {
                ...post,
                series: value,
                hasSeriesChanged: post.persistedSeries !== value
            };
        }));
    };

    const handleSeriesSubmit = async (postUrl: string) => {
        const post = posts.find(p => p.url === postUrl);
        if (!post || savingSeriesPostUrls.has(postUrl)) return;

        const submittedSeries = post.series || '';
        setSavingSeriesPostUrls(prev => new Set(prev).add(postUrl));

        try {
            const { data } = await updatePostSeries(username, postUrl, submittedSeries);

            if (data.status === 'DONE') {
                const persistedSeries = data.body.series || '';
                setPosts(prev => prev.map(currentPost => {
                    if (currentPost.url !== postUrl) return currentPost;

                    const series = (currentPost.series || '') === submittedSeries
                        ? persistedSeries
                        : currentPost.series || '';

                    return {
                        ...currentPost,
                        series,
                        persistedSeries,
                        hasSeriesChanged: series !== persistedSeries
                    };
                }));
                toast.success(t({
                    id: 'settings.posts.series.update_success',
                    message: 'Series updated.'
                }));
            } else {
                toast.error(data.errorMessage || t({
                    id: 'settings.posts.series.update_failed',
                    message: 'Could not update the series.'
                }));
            }
        } catch {
            toast.error(t({
                id: 'settings.posts.series.update_failed',
                message: 'Could not update the series.'
            }));
        } finally {
            setSavingSeriesPostUrls(prev => {
                const next = new Set(prev);
                next.delete(postUrl);
                return next;
            });
        }
    };

    return {
        handleVisibilityToggle,
        handleDelete,
        handleTagChange,
        handleTagSubmit,
        handleSeriesChange,
        handleSeriesSubmit,
        savingTagPostUrls,
        savingSeriesPostUrls
    };
};
