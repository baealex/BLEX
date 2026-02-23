import { useState, useEffect } from 'react';
import { logger } from '~/utils/logger';
import { getRelatedPosts, type RelatedPost } from '~/lib/api/posts';

interface RelatedPostsProps {
    postUrl: string;
    username: string;
}

const SkeletonCard = () => (
    <div className="flex flex-col h-full bg-surface rounded-2xl overflow-hidden ring-1 ring-line/5 animate-pulse">
        <div className="aspect-[16/9] bg-surface-subtle" />
        <div className="flex flex-col flex-grow p-5">
            <div className="h-5 bg-surface-subtle rounded-lg w-4/5 mb-3" />
            <div className="h-4 bg-surface-subtle rounded-lg w-full mb-2" />
            <div className="h-4 bg-surface-subtle rounded-lg w-2/3 mb-4" />
            <div className="flex items-center justify-between mt-auto pt-3 border-t border-line-light">
                <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-surface-subtle" />
                    <div className="h-3 bg-surface-subtle rounded w-16" />
                </div>
                <div className="h-3 bg-surface-subtle rounded w-10" />
            </div>
        </div>
    </div>
);

const PostCard = ({ relatedPost }: { relatedPost: RelatedPost }) => {
    const postUrl = `/@${relatedPost.authorUsername}/${relatedPost.url}`;
    const authorUrl = `/@${relatedPost.authorUsername}`;

    const hasThumbnail = !!relatedPost.image;
    let minSrc = '';
    let fullSrc = '';

    if (hasThumbnail) {
        fullSrc = window.configuration.media + relatedPost.image;
        const ext = relatedPost.image!.split('.').pop();
        minSrc = `${fullSrc}.minify.${ext}`;
    }

    return (
        <article className="group flex flex-col h-full bg-surface rounded-2xl overflow-hidden ring-1 ring-line/5 hover:ring-line/10 active:scale-[0.98] transition-all duration-150">
            {hasThumbnail && (
                <div className="aspect-[16/9] overflow-hidden">
                    <a href={postUrl} className="block h-full">
                        <img
                            className="w-full h-full object-cover motion-safe:group-hover:scale-105 motion-safe:transition-transform motion-safe:duration-500"
                            src={minSrc}
                            srcSet={`${minSrc} 400w, ${fullSrc} 800w`}
                            sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                            alt={relatedPost.title}
                            loading="lazy"
                        />
                    </a>
                </div>
            )}

            <div className="flex flex-col flex-grow p-5">
                <h3 className="text-base font-bold text-content leading-snug mb-2 line-clamp-2">
                    <a href={postUrl} className="hover:text-content transition-colors duration-150">
                        {relatedPost.title}
                    </a>
                </h3>

                <div className="text-xs text-content-secondary mb-3 flex items-center gap-3">
                    <time dateTime={relatedPost.publishedDate}>
                        {relatedPost.publishedDate}
                    </time>
                    <span>{relatedPost.readTime}분</span>
                </div>

                <p className={`text-sm text-content-secondary leading-relaxed mb-4 ${hasThumbnail ? 'line-clamp-2' : 'line-clamp-3 flex-grow'}`}>
                    <a href={postUrl} className="hover:text-content transition-colors">
                        {relatedPost.metaDescription}
                    </a>
                </p>

                <div className="flex items-center mt-auto pt-3 border-t border-line-light">
                    <a href={authorUrl} className="flex items-center gap-2 min-w-0">
                        {relatedPost.authorImage ? (
                            <img
                                src={window.configuration.media + relatedPost.authorImage}
                                alt={relatedPost.authorName}
                                className="w-6 h-6 rounded-full ring-2 ring-line-light flex-shrink-0"
                                loading="lazy"
                            />
                        ) : (
                            <div className="w-6 h-6 rounded-full bg-surface-subtle flex items-center justify-center flex-shrink-0">
                                <i className="far fa-user text-[10px] text-content-hint" />
                            </div>
                        )}
                        <span className="text-xs font-semibold text-content hover:text-content transition-colors truncate">
                            {relatedPost.authorUsername}
                        </span>
                    </a>
                </div>
            </div>
        </article>
    );
};

const RelatedPosts = ({ postUrl, username }: RelatedPostsProps) => {
    const [relatedPosts, setRelatedPosts] = useState<RelatedPost[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchRelatedPosts = async () => {
            try {
                const { data } = await getRelatedPosts(username, postUrl);
                if (data.status === 'DONE') {
                    const posts = data.body.posts || [];
                    const count = posts.length >= 8 ? 8 : posts.length >= 4 ? 4 : posts.length;
                    setRelatedPosts(posts.slice(0, count));
                }
            } catch (error) {
                logger.error('Failed to fetch related posts:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchRelatedPosts();
    }, [postUrl, username]);

    if (isLoading) {
        return (
            <div>
                <div className="flex items-center gap-3 mb-8">
                    <div className="w-1.5 h-6 bg-action rounded-full" />
                    <h3 className="text-xl sm:text-2xl font-bold text-content">관련 포스트</h3>
                </div>
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                    <SkeletonCard />
                    <SkeletonCard />
                    <SkeletonCard />
                    <SkeletonCard />
                </div>
            </div>
        );
    }

    if (relatedPosts.length === 0) {
        return (
            <div className="text-center py-12">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-surface-subtle rounded-full mb-4">
                    <i className="fas fa-compass text-2xl text-content-hint" />
                </div>
                <h3 className="text-lg font-semibold text-content mb-2">
                    {username}의 다른 글 둘러보기
                </h3>
                <p className="text-content-secondary text-sm mb-6">
                    프로필에서 더 많은 글을 확인할 수 있습니다.
                </p>
                <a
                    href={`/@${username}`}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-action text-content-inverted rounded-full text-sm font-medium hover:bg-action-hover transition-colors active:scale-95">
                    <span>프로필 보기</span>
                    <i className="fas fa-arrow-right text-xs opacity-70" />
                </a>
            </div>
        );
    }

    return (
        <div>
            <div className="flex items-center gap-3 mb-8">
                <div className="w-1.5 h-6 bg-action rounded-full" />
                <h3 className="text-xl sm:text-2xl font-bold text-content">관련 포스트</h3>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {relatedPosts.map((relatedPost) => (
                    <PostCard
                        key={`${relatedPost.authorUsername}-${relatedPost.url}`}
                        relatedPost={relatedPost}
                    />
                ))}
            </div>
        </div>
    );
};

export default RelatedPosts;
