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
            <div className="flex items-center gap-2 mb-6">
                <div className="w-1 h-6 bg-black rounded-full" />
                <h3 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">관련 포스트</h3>
            </div>

            <div className="grid gap-6 sm:gap-8 md:grid-cols-2 lg:grid-cols-3">
                {relatedPosts.map((relatedPost) => (
                    <div key={`${relatedPost.authorUsername}-${relatedPost.url}`} className="group">
                        <a href={`/@${relatedPost.authorUsername}/${relatedPost.url}`} className="block h-full flex flex-col">
                            <div className="aspect-[16/10] mb-4 overflow-hidden rounded-2xl bg-gray-100 relative shadow-sm group-hover:shadow-md transition-all duration-300">
                                {relatedPost.image ? (
                                    <img
                                        className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-500 ease-out"
                                        src={window.configuration.media + relatedPost.image}
                                        alt={relatedPost.title}
                                    />
                                ) : (
                                    <div className="w-full h-full bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
                                        <i className="fas fa-file-alt text-3xl text-gray-300 group-hover:text-gray-400 transition-colors" />
                                    </div>
                                )}
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors duration-300" />
                            </div>

                            <div className="flex flex-col flex-grow">
                                <h4 className="font-bold text-gray-900 mb-2 group-hover:text-black transition-colors text-lg leading-snug line-clamp-2">
                                    {relatedPost.title}
                                </h4>

                                <p className="text-gray-500 text-sm mb-4 line-clamp-2 leading-relaxed flex-grow">
                                    {relatedPost.metaDescription}
                                </p>

                                <div className="flex items-center gap-3 text-xs font-medium text-gray-400 mt-auto pt-3 border-t border-gray-100/50">
                                    <div className="flex items-center gap-1.5">
                                        <i className="far fa-calendar" />
                                        <span>{relatedPost.createdDate}</span>
                                    </div>
                                    <div className="w-0.5 h-0.5 bg-gray-300 rounded-full" />
                                    <div className="flex items-center gap-1.5">
                                        <i className="far fa-clock" />
                                        <span>{relatedPost.readTime}분</span>
                                    </div>
                                </div>
                            </div>
                        </a>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default RelatedPosts;
