export const POST_LINK_TRIGGER = '[';
const POST_LINK_CLASS = 'post-link';
export const POST_LINK_SEARCH_DEBOUNCE_MS = 150;

// Post titles are capped at 65 characters, so a longer query can never match.
const POST_LINK_QUERY_MAX_LENGTH = 65;

export interface PostLinkCandidate {
    title: string;
    href: string;
    meta?: string;
}

export interface PostLinkSearchOptions {
    signal: AbortSignal;
}

export type PostLinkSearch = (
    query: string,
    options: PostLinkSearchOptions
) => Promise<PostLinkCandidate[]>;

export const isPostLinkQuery = (query: string) => (
    query.length <= POST_LINK_QUERY_MAX_LENGTH && !query.includes(']')
);

export const buildPostLinkContent = (candidate: PostLinkCandidate) => [
    {
        type: 'text',
        text: candidate.title,
        marks: [{
            type: 'link',
            attrs: {
                href: candidate.href,
                class: POST_LINK_CLASS
            }
        }]
    },
    {
        type: 'text',
        text: ' '
    }
];
