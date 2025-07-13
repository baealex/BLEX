import React, { useState } from 'react';
import { http } from '~/modules/http.module';

interface LikeButtonProps {
    postId: string;
    likesCount: number;
    hasLiked: boolean;
}

/**
 * 게시글 좋아요 버튼 컴포넌트
 */
const LikeButton: React.FC<LikeButtonProps> = ({ postId, likesCount, hasLiked }) => {
    const [count, setCount] = useState<number>(likesCount);
    const [liked, setLiked] = useState<boolean>(hasLiked);
    const [isLoading, setIsLoading] = useState<boolean>(false);

    const handleLike = async (): Promise<void> => {
        if (isLoading) return;

        setIsLoading(true);
        try {
            const response = await http(`/like/${postId}`, {
                method: 'POST',
            });

            if (response.status === 200) {
                const data = response.data;
                setCount(data.count_likes);
                setLiked(data.has_liked);
            } else {
                console.error('Failed to like post');
            }
        } catch (error) {
            console.error('Error liking post:', error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <>
            <button
                onClick={handleLike}
                className={`like-button ${liked ? 'liked' : ''} ${isLoading ? 'loading' : ''}`}
                disabled={isLoading}
            >
                <i className={`fas fa-heart icon ${liked ? 'liked' : ''}`}></i>
                <span className="count">{count}</span>
            </button>

            <style jsx>{`
                .like-button {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    padding: 4px 12px;
                    border: none;
                    border-radius: 20px;
                    background-color: #f8f9fa;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    outline: none;
                    font-weight: 500;
                    color: #495057;
                }
                
                .like-button.liked {
                    background-color: #ffe3e3;
                    color: #e03131;
                }
                
                .like-button.loading {
                    opacity: 0.7;
                    cursor: not-allowed;
                }
                
                .icon {
                    margin-right: 6px;
                    font-size: 16px;
                }
                
                .icon.liked {
                    color: #e03131;
                }
                
                .count {
                    font-size: 14px;
                }
            `}</style>
        </>
    );
};

export default LikeButton;
