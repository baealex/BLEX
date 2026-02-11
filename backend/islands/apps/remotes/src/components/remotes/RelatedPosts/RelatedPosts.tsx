import { useState, useEffect } from 'react';
import { logger } from '~/utils/logger';
import { getRelatedPosts, type RelatedPost } from '~/lib/api/posts';

interface RelatedPostsProps {
    postUrl: string;
    username: string;
}

const SkeletonCard = () => (
    <div className="flex flex-col h-full bg-white rounded-2xl overflow-hidden ring-1 ring-gray-900/5 animate-pulse">
        <div className="aspect-[16/9] bg-gray-100" />
        <div className="flex flex-col flex-grow p-5">
            <div className="h-5 bg-gray-100 rounded-lg w-4/5 mb-3" />
            <div className="h-4 bg-gray-50 rounded-lg w-full mb-2" />
            <div className="h-4 bg-gray-50 rounded-lg w-2/3 mb-4" />
            <div className="flex items-center justify-between mt-auto pt-3 border-t border-gray-100">
                <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-gray-100" />
                    <div className="h-3 bg-gray-100 rounded w-16" />
                </div>
                <div className="h-3 bg-gray-50 rounded w-10" />
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
        <article className="group flex flex-col h-full bg-white rounded-2xl overflow-hidden ring-1 ring-gray-900/5 hover:ring-gray-900/10 active:scale-[0.98] transition-all duration-150">
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
                <h3 className="text-base font-bold text-gray-900 leading-snug mb-2 line-clamp-2">
                    <a href={postUrl} className="hover:text-gray-700 transition-colors duration-150">
                        {relatedPost.title}
                    </a>
                </h3>

                <div className="text-xs text-gray-500 mb-3 flex items-center gap-3">
                    <time dateTime={relatedPost.publishedDate}>
                        {relatedPost.publishedDate}
                    </time>
                    <span>{relatedPost.readTime}분</span>
                </div>

                <p className={`text-sm text-gray-600 leading-relaxed mb-4 ${hasThumbnail ? 'line-clamp-2' : 'line-clamp-3 flex-grow'}`}>
                    <a href={postUrl} className="hover:text-gray-700 transition-colors">
                        {relatedPost.metaDescription}
                    </a>
                </p>

                <div className="flex items-center mt-auto pt-3 border-t border-gray-100">
                    <a href={authorUrl} className="flex items-center gap-2 min-w-0">
                        {relatedPost.authorImage ? (
                            <img
                                src={window.configuration.media + relatedPost.authorImage}
                                alt={relatedPost.authorName}
                                className="w-6 h-6 rounded-full ring-2 ring-gray-100 flex-shrink-0"
                                loading="lazy"
                            />
                        ) : (
                            <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                                <i className="far fa-user text-[10px] text-gray-400" />
                            </div>
                        )}
                        <span className="text-xs font-semibold text-gray-900 hover:text-gray-700 transition-colors truncate">
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
                    <div className="w-1.5 h-6 bg-gray-900 rounded-full" />
                    <h3 className="text-xl sm:text-2xl font-bold text-gray-900">관련 포스트</h3>
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
                <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
                    <i className="fas fa-compass text-2xl text-gray-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {username}의 다른 글 둘러보기
                </h3>
                <p className="text-gray-500 text-sm mb-6">
                    프로필에서 더 많은 글을 확인할 수 있습니다.
                </p>
                <a
                    href={`/@${username}`}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-gray-900 text-white rounded-full text-sm font-medium hover:bg-gray-800 transition-colors active:scale-95">
                    <span>프로필 보기</span>
                    <i className="fas fa-arrow-right text-xs opacity-70" />
                </a>
            </div>
        );
    }

    return (
        <div>
            <div className="flex items-center gap-3 mb-8">
                <div className="w-1.5 h-6 bg-gray-900 rounded-full" />
                <h3 className="text-xl sm:text-2xl font-bold text-gray-900">관련 포스트</h3>
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
