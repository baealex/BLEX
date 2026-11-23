import type { PostLinkCandidate } from '~/features/editor/tiptap/tiptap-editor';
import { getPosts } from '~/lib/api/posts';
import { toPostLinkCandidates } from './postLinkCandidates';

interface PostLinkSearchOptions {
    signal: AbortSignal;
    currentPostUrl: string;
}

// Hidden posts return 404 to readers, so only public posts are offered as link targets.
export const searchPostLinks = async (
    query: string,
    { signal, currentPostUrl }: PostLinkSearchOptions
): Promise<PostLinkCandidate[]> => {
    const { data } = await getPosts(
        {
            search: query,
            visibility: 'public'
        },
        { signal }
    );

    if (data.status !== 'DONE') {
        throw new Error(data.errorMessage || 'Post link search failed.');
    }

    return toPostLinkCandidates(data.body, currentPostUrl);
};
