import type { PostLinkCandidate } from '@blex/editor/tiptap-editor';

interface PostLinkSearchResult {
    username: string;
    posts: {
        url: string;
        title: string;
        createdDate: string;
    }[];
}

export const toPostLinkCandidates = (
    result: PostLinkSearchResult,
    currentPostUrl: string
): PostLinkCandidate[] => result.posts
    .filter(post => post.url !== currentPostUrl)
    .map(post => ({
        title: post.title,
        href: `/@${result.username}/${post.url}`,
        meta: post.createdDate
    }));
