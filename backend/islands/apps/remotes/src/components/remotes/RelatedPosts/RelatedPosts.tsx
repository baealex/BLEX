import { useState, useEffect } from 'react';
import { logger } from '~/utils/logger';
import { getRelatedPosts, type RelatedPost } from '~/lib/api/posts';

interface RelatedPostsProps {
    postUrl: string;
    username: string;
}

const RelatedPosts = ({ postUrl, username }: RelatedPostsProps) => {
    const [relatedPosts, setRelatedPosts] = useState<RelatedPost[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchRelatedPosts = async () => {
            try {
                const { data } = await getRelatedPosts(username, postUrl);
                if (data.status === 'DONE') {
                    setRelatedPosts(data.body.posts || []);
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
        return null;
    }

    if (relatedPosts.length === 0) {
        const authorUrl = `/@${username}`;
        return (
            <div className="text-center py-12">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
                    <i className="fas fa-feather-alt text-2xl text-gray-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    더 많은 글이 궁금하신가요?
                </h3>
                <p className="text-gray-500 text-sm mb-6">
                    작성자의 프로필에서 다른 글들을 확인해보세요.
                </p>
                <a
                    href={authorUrl}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-gray-900 text-white rounded-full text-sm font-medium hover:bg-gray-800 transition-colors active:scale-95">
                    <span>{username}의 프로필 보기</span>
                    <i className="fas fa-arrow-right text-xs opacity-70" />
                </a>
            </div>
        );
    }

    return (
        <div>
            <div className="flex items-center gap-3 mb-8">
                <div className="w-1.5 h-8 bg-gray-900 rounded-full" />
                <h3 className="text-2xl sm:text-3xl font-bold text-gray-900">관련 포스트</h3>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {relatedPosts.map((relatedPost) => {
                    const postUrl = `/@${relatedPost.authorUsername}/${relatedPost.url}`;
                    const authorUrl = `/@${relatedPost.authorUsername}`;

                    return (
                        <article
                            key={`${relatedPost.authorUsername}-${relatedPost.url}`}
                            className="group flex flex-col h-full bg-white rounded-2xl overflow-hidden ring-1 ring-gray-900/5 hover:ring-gray-900/10 active:scale-[0.98] transition-all duration-150">
                            {/* Thumbnail */}
                            {relatedPost.image && (
                                <div className="aspect-[16/9] overflow-hidden">
                                    <a href={postUrl} className="block h-full">
                                        <img
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                            src={window.configuration.media + relatedPost.image}
                                            alt={relatedPost.title}
                                        />
                                    </a>
                                </div>
                            )}

                            {/* Content */}
                            <div className="flex flex-col flex-grow p-5">
                                {/* Title */}
                                <h3 className="text-md font-bold text-gray-900 leading-snug mb-2 line-clamp-2">
                                    <a
                                        href={postUrl}
                                        className="hover:text-gray-700 transition-colors duration-150">
                                        {relatedPost.title}
                                    </a>
                                </h3>

                                {/* Description */}
                                <p
                                    className={`text-sm text-gray-500 leading-relaxed mb-4 ${
                                        relatedPost.image ? 'line-clamp-2' : 'line-clamp-3 flex-grow'
                                    }`}>
                                    <a href={postUrl} className="hover:text-gray-600 transition-colors">
                                        {relatedPost.metaDescription}
                                    </a>
                                </p>

                                {/* Footer: Author + Read Time */}
                                <div className="flex items-center justify-between mt-auto pt-3 border-t border-gray-100">
                                    <a href={authorUrl} className="flex items-center gap-2 min-w-0">
                                        {relatedPost.authorImage ? (
                                            <img
                                                src={window.configuration.media + relatedPost.authorImage}
                                                alt={relatedPost.authorName}
                                                className="w-5 h-5 rounded-full ring-1 ring-gray-100 flex-shrink-0"
                                            />
                                        ) : (
                                            <div className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                                                <i className="far fa-user text-[10px] text-gray-400" />
                                            </div>
                                        )}
                                        <span className="text-xs font-medium text-gray-600 hover:text-gray-900 transition-colors truncate">
                                            {relatedPost.authorUsername}
                                        </span>
                                    </a>
                                    <span className="text-xs text-gray-400 flex-shrink-0">
                                        {relatedPost.readTime}분
                                    </span>
                                </div>
                            </div>
                        </article>
                    );
                })}
            </div>
        </div>
    );
};

export default RelatedPosts;
