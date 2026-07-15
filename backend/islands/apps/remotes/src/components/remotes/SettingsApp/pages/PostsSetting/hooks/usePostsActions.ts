import { useState } from 'react';
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
                toast.success(`포스트가 ${data.body.isHide ? '비공개' : '공개'}로 변경되었습니다.`);
            } else {
                throw new Error('Failed to toggle visibility');
            }
        } catch {
            toast.error('포스트 공개 설정 변경에 실패했습니다.');
        }
    };

    const handleDelete = async (postUrl: string) => {
        const confirmed = await confirm({
            title: '휴지통으로 이동',
            message: '이 포스트를 휴지통으로 옮길까요? 나중에 복원할 수 있습니다.',
            confirmText: '휴지통으로 이동',
            variant: 'danger'
        });

        if (!confirmed) return;

        try {
            const { data } = await deletePost(username, postUrl);

            if (data.status === 'DONE') {
                clearPostClassificationDraft(username, postUrl);
                toast.success('포스트를 휴지통으로 옮겼습니다.');
                refetch();
            } else {
                throw new Error('Failed to delete post');
            }
        } catch {
            toast.error('포스트를 휴지통으로 옮기지 못했습니다.');
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
                toast.success('태그가 수정되었습니다.');
            } else {
                throw new Error('Failed to update tag');
            }
        } catch {
            toast.error('태그 수정에 실패했습니다.');
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
                toast.success('시리즈가 수정되었습니다.');
            } else {
                throw new Error('Failed to update series');
            }
        } catch {
            toast.error('시리즈 수정에 실패했습니다.');
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
