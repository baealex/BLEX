export const MAX_RELATED_POSTS = 8;

export const selectVisibleRelatedPosts = <T>(posts: readonly T[]): T[] => (
    posts.slice(0, MAX_RELATED_POSTS)
);
