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
                            className="group flex flex-col h-full bg-white rounded-xl overflow-hidden ring-1 ring-gray-900/5 hover:bg-gray-50/50 transition-colors duration-200">
                            {/* Thumbnail */}
                            <a href={postUrl} className="block overflow-hidden">
                                <div className="aspect-[16/10] relative bg-gray-100">
                                    {relatedPost.image ? (
                                        <img
                                            className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-500"
                                            src={window.configuration.media + relatedPost.image}
                                            alt={relatedPost.title}
                                        />
                                    ) : (
                                        <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                                            <i className="fas fa-file-alt text-4xl text-gray-300" />
                                        </div>
                                    )}
                                </div>
                            </a>

                            {/* Content */}
                            <div className="flex flex-col flex-grow p-5 sm:p-6">
                                {/* Title */}
                                <a href={postUrl} className="block mb-2">
                                    <h4 className="font-semibold text-gray-900 text-lg leading-snug line-clamp-2">
                                        {relatedPost.title}
                                    </h4>
                                </a>

                                {/* Description */}
                                <p className="text-gray-600 text-sm mb-4 line-clamp-2 leading-relaxed flex-grow">
                                    {relatedPost.metaDescription}
                                </p>

                                {/* Meta Info */}
                                <div className="mt-auto pt-4 border-t border-gray-100">
                                    {/* Author */}
                                    <a
                                        href={authorUrl}
                                        className="flex items-center gap-2 mb-2 group/author">
                                        {relatedPost.authorImage ? (
                                            <img
                                                src={window.configuration.media + relatedPost.authorImage}
                                                alt={relatedPost.authorName}
                                                className="w-6 h-6 rounded-full object-cover ring-2 ring-gray-100 group-hover/author:ring-gray-300 transition-all duration-200"
                                            />
                                        ) : (
                                            <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center">
                                                <i className="far fa-user text-xs text-gray-400" />
                                            </div>
                                        )}
                                        <span className="text-sm font-medium text-gray-700 group-hover/author:text-gray-900 transition-colors duration-150">
                                            {relatedPost.authorUsername}
                                        </span>
                                    </a>

                                    {/* Date & Read Time */}
                                    <div className="flex items-center gap-2 text-xs text-gray-600">
                                        <span className="flex items-center gap-1">
                                            <i className="far fa-calendar" />
                                            {relatedPost.createdDate}
                                        </span>
                                        <span>·</span>
                                        <span className="flex items-center gap-1">
                                            <i className="far fa-clock" />
                                            {relatedPost.readTime}분
                                        </span>
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
