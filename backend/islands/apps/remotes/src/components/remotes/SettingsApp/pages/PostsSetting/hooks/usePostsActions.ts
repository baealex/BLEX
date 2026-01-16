import { toast } from '~/utils/toast';
import { useConfirm } from '~/hooks/useConfirm';
import {
    togglePostVisibility,
    togglePostNotice,
    deletePost,
    updatePostTags,
    updatePostSeries
} from '~/lib/api/posts';
import type { Post } from './usePostsData';

interface UsePostsActionsProps {
    username: string;
    posts: Post[];
    setPosts: React.Dispatch<React.SetStateAction<Post[]>>;
    refetch: () => void;
}

interface UsePostsActionsReturn {
    handleVisibilityToggle: (postUrl: string) => Promise<void>;
    handleNoticeToggle: (postUrl: string) => Promise<void>;
    handleDelete: (postUrl: string) => Promise<void>;
    handleTagChange: (postUrl: string, value: string) => void;
    handleTagSubmit: (postUrl: string) => Promise<void>;
    handleSeriesChange: (postUrl: string, value: string) => void;
    handleSeriesSubmit: (postUrl: string) => Promise<void>;
}

export const usePostsActions = ({
    username,
    posts,
    setPosts,
    refetch
}: UsePostsActionsProps): UsePostsActionsReturn => {
    const { confirm } = useConfirm();

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

    const handleNoticeToggle = async (postUrl: string) => {
        try {
            const { data } = await togglePostNotice(username, postUrl);

            if (data.status === 'DONE') {
                setPosts(prev => prev.map(post =>
                    post.url === postUrl
                        ? {
                            ...post,
                            isNotice: data.body.isNotice
                        }
                        : post
                ));
                toast.success(`포스트가 ${data.body.isNotice ? '공지로 설정' : '공지 해제'}되었습니다.`);
                refetch();
            } else {
                throw new Error('Failed to toggle notice');
            }
        } catch {
            toast.error('공지 설정 변경에 실패했습니다.');
        }
    };

    const handleDelete = async (postUrl: string) => {
        const confirmed = await confirm({
            title: '포스트 삭제',
            message: '정말 이 포스트를 삭제할까요?',
            confirmText: '삭제',
            variant: 'danger'
        });

        if (!confirmed) return;

        try {
            const { data } = await deletePost(username, postUrl);

            if (data.status === 'DONE') {
                toast.success('포스트가 삭제되었습니다.');
                refetch();
            } else {
                throw new Error('Failed to delete post');
            }
        } catch {
            toast.error('포스트 삭제에 실패했습니다.');
        }
    };

    const handleTagChange = (postUrl: string, value: string) => {
        setPosts(prev => prev.map(post =>
            post.url === postUrl
                ? {
                    ...post,
                    tag: value,
                    hasTagChanged: post.tag !== value
                }
                : post
        ));
    };

    const handleTagSubmit = async (postUrl: string) => {
        const post = posts.find(p => p.url === postUrl);
        if (!post) return;

        try {
            const { data } = await updatePostTags(username, postUrl, post.tag);

            if (data.status === 'DONE') {
                setPosts(prev => prev.map(p =>
                    p.url === postUrl
                        ? {
                            ...p,
                            tag: data.body.tag || '',
                            hasTagChanged: false
                        }
                        : p
                ));
                toast.success('태그가 수정되었습니다.');
            } else {
                throw new Error('Failed to update tag');
            }
        } catch {
            toast.error('태그 수정에 실패했습니다.');
        }
    };

    const handleSeriesChange = (postUrl: string, value: string) => {
        setPosts(prev => prev.map(post =>
            post.url === postUrl
                ? {
                    ...post,
                    series: value,
                    hasSeriesChanged: post.series !== value
                }
                : post
        ));
    };

    const handleSeriesSubmit = async (postUrl: string) => {
        const post = posts.find(p => p.url === postUrl);
        if (!post) return;

        try {
            const { data } = await updatePostSeries(username, postUrl, post.series || '');

            if (data.status === 'DONE') {
                setPosts(prev => prev.map(p =>
                    p.url === postUrl
                        ? {
                            ...p,
                            series: data.body.series || '',
                            hasSeriesChanged: false
                        }
                        : p
                ));
                toast.success('시리즈가 수정되었습니다.');
            } else {
                throw new Error('Failed to update series');
            }
        } catch {
            toast.error('시리즈 수정에 실패했습니다.');
        }
    };

    return {
        handleVisibilityToggle,
        handleNoticeToggle,
        handleDelete,
        handleTagChange,
        handleTagSubmit,
        handleSeriesChange,
        handleSeriesSubmit
    };
};
