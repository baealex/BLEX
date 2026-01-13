import { useState, useEffect } from 'react';
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
                console.error('Failed to fetch related posts:', error);
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
        return null;
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
                                <h3 className="text-md font-bold text-gray-900 leading-snug mb-3 line-clamp-2">
                                    <a
                                        href={postUrl}
                                        className="hover:text-gray-700 transition-colors duration-150">
                                        {relatedPost.title}
                                    </a>
                                </h3>

                                {/* Meta Info (Date & Read Time) */}
                                <div className="text-xs text-gray-500 mb-3 flex items-center gap-3">
                                    <div className="flex items-center gap-1.5">
                                        <i className="far fa-calendar-alt text-gray-400" />
                                        <span>{relatedPost.createdDate}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <i className="far fa-clock text-gray-400" />
                                        <span>{relatedPost.readTime}분</span>
                                    </div>
                                </div>

                                {/* Description */}
                                <p
                                    className={`text-sm text-gray-600 leading-relaxed mb-4 ${
                                        relatedPost.image ? 'line-clamp-3' : 'flex-grow'
                                    }`}>
                                    <a href={postUrl}>{relatedPost.metaDescription}</a>
                                </p>

                                {/* Author */}
                                <div className="flex items-center gap-2 mt-auto pt-4 border-t border-gray-100">
                                    <a href={authorUrl} className="flex-shrink-0">
                                        {relatedPost.authorImage ? (
                                            <img
                                                src={window.configuration.media + relatedPost.authorImage}
                                                alt={relatedPost.authorName}
                                                className="w-6 h-6 rounded-full ring-2 ring-gray-100"
                                            />
                                        ) : (
                                            <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center">
                                                <i className="far fa-user text-xs text-gray-400" />
                                            </div>
                                        )}
                                    </a>
                                    <div className="flex flex-col min-w-0">
                                        <a
                                            href={authorUrl}
                                            className="font-semibold text-gray-900 hover:text-gray-700 transition-colors text-xs truncate">
                                            {relatedPost.authorUsername}
                                        </a>
                                    </div>
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
