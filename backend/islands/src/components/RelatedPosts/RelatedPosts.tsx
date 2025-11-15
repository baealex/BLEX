import React, { useState, useEffect } from 'react';
import { http } from '~/modules/http.module';

interface RelatedPost {
    title: string;
    url: string;
    authorUsername: string;
    metaDescription: string;
    image?: string;
    createdDate: string;
    readTime: number;
}

interface RelatedPostsProps {
    postUrl: string;
    username: string;
}

const RelatedPosts: React.FC<RelatedPostsProps> = ({ postUrl, username }) => {
    const [relatedPosts, setRelatedPosts] = useState<RelatedPost[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchRelatedPosts = async () => {
            try {
                const { data } = await http(`v1/users/@${username}/posts/${postUrl}/related`);
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
        return (
            <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-6 lg:p-8 shadow-sm">
                <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4 sm:mb-6">관련 포스트</h3>
                <div className="grid gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {[...Array(3)].map((_, index) => (
                        <div key={index} className="animate-pulse">
                            <div className="aspect-video mb-4 bg-gray-200 rounded-lg" />
                            <div className="h-4 bg-gray-200 rounded mb-2" />
                            <div className="h-3 bg-gray-200 rounded mb-3 w-3/4" />
                            <div className="flex gap-4">
                                <div className="h-3 bg-gray-200 rounded w-20" />
                                <div className="h-3 bg-gray-200 rounded w-16" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (relatedPosts.length === 0) {
        return null;
    }

    return (
        <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-6 lg:p-8 shadow-sm">
            <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4 sm:mb-6">관련 포스트</h3>
            <div className="grid gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
                {relatedPosts.map((relatedPost) => (
                    <div key={`${relatedPost.authorUsername}-${relatedPost.url}`} className="group">
                        <a href={`/@${relatedPost.authorUsername}/${relatedPost.url}`} className="block">
                            {relatedPost.image ? (
                                <div className="aspect-video mb-4 overflow-hidden rounded-lg bg-gray-100">
                                    <img
                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                                        src={window.configuration.media + relatedPost.image}
                                        alt={relatedPost.title}
                                    />
                                </div>
                            ) : (
                                <div className="aspect-video mb-4 bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg flex items-center justify-center">
                                    <i className="fas fa-file-alt text-3xl text-gray-400" />
                                </div>
                            )}

                            <h4 className="font-bold text-gray-900 mb-2 group-hover:text-gray-600 transition-colors">
                                {relatedPost.title}
                            </h4>

                            <p className="text-gray-600 text-sm mb-3 line-clamp-2">
                                {relatedPost.metaDescription}
                            </p>

                            <div className="flex items-center gap-4 text-xs text-gray-500">
                                <div className="flex items-center gap-1">
                                    <i className="far fa-calendar" />
                                    <span>{relatedPost.createdDate}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <i className="far fa-clock" />
                                    <span>{relatedPost.readTime}분</span>
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
