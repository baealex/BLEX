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
            <div className="flex items-center gap-3 mb-10">
                <div className="w-1.5 h-8 bg-gradient-to-b from-black to-gray-600 rounded-full" />
                <h3 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">관련 포스트</h3>
            </div>

            <div className="grid gap-8 md:gap-10 md:grid-cols-2 lg:grid-cols-3">
                {relatedPosts.map((relatedPost) => {
                    const postUrl = `/@${relatedPost.authorUsername}/${relatedPost.url}`;
                    const authorUrl = `/@${relatedPost.authorUsername}`;

                    return (
                        <article
                            key={`${relatedPost.authorUsername}-${relatedPost.url}`}
                            className="group flex flex-col h-full bg-white rounded-3xl overflow-hidden shadow-sm hover:shadow-2xl transition-all duration-500 ease-out">
                            {/* Thumbnail */}
                            <a href={postUrl} className="block overflow-hidden">
                                <div className="aspect-[16/10] relative bg-gray-100">
                                    {relatedPost.image ? (
                                        <img
                                            className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-700 ease-out"
                                            src={window.configuration.media + relatedPost.image}
                                            alt={relatedPost.title}
                                        />
                                    ) : (
                                        <div className="w-full h-full bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
                                            <i className="fas fa-file-alt text-4xl text-gray-300 group-hover:text-gray-400 transition-colors duration-300" />
                                        </div>
                                    )}
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors duration-300" />
                                </div>
                            </a>

                            {/* Content */}
                            <div className="flex flex-col flex-grow p-6">
                                {/* Title */}
                                <a href={postUrl} className="block mb-3">
                                    <h4 className="font-semibold text-gray-900 group-hover:text-black transition-colors duration-200 text-xl leading-snug line-clamp-2">
                                        {relatedPost.title}
                                    </h4>
                                </a>

                                {/* Description */}
                                <p className="text-gray-500 text-[15px] mb-5 line-clamp-2 leading-relaxed flex-grow">
                                    {relatedPost.metaDescription}
                                </p>

                                {/* Meta Info */}
                                <div className="mt-auto pt-5 border-t border-gray-100">
                                    {/* Author */}
                                    <a
                                        href={authorUrl}
                                        className="flex items-center gap-2.5 mb-3 group/author">
                                        {relatedPost.authorImage ? (
                                            <img
                                                src={window.configuration.media + relatedPost.authorImage}
                                                alt={relatedPost.authorName}
                                                className="w-6 h-6 rounded-full object-cover ring-2 ring-gray-100 group-hover/author:ring-gray-300 transition-all"
                                            />
                                        ) : (
                                            <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center">
                                                <i className="far fa-user text-xs text-gray-400" />
                                            </div>
                                        )}
                                        <span className="text-sm font-medium text-gray-700 group-hover/author:text-gray-900 transition-colors">
                                            {relatedPost.authorName || relatedPost.authorUsername}
                                        </span>
                                    </a>

                                    {/* Date & Read Time */}
                                    <div className="flex items-center gap-3 text-xs text-gray-400">
                                        <span className="flex items-center gap-1.5">
                                            <i className="far fa-calendar" />
                                            {relatedPost.createdDate}
                                        </span>
                                        <span>·</span>
                                        <span className="flex items-center gap-1.5">
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
