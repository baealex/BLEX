import React, { useState } from 'react';
import styles from './LikeButton.module.scss';
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
        <button
            onClick={handleLike}
            className={`${styles.likeButton} ${liked ? styles.liked : ''} ${isLoading ? styles.loading : ''}`}
            disabled={isLoading}
        >
            <i className={`fas fa-heart ${styles.icon} ${liked ? styles.liked : ''}`}></i>
            <span className={styles.count}>{count}</span>
        </button>
    );
};

export default LikeButton;
