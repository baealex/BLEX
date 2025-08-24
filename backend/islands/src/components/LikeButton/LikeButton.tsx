import { useState } from 'react';
import { http } from '~/modules/http.module';
import styles from './LikeButton.module.scss';

interface LikeButtonProps {
    postId: string;
    likesCount: number;
    hasLiked: boolean;
}

const LikeButton = ({ postId, likesCount, hasLiked }: LikeButtonProps) => {
    const [count, setCount] = useState<number>(likesCount);
    const [liked, setLiked] = useState<boolean>(hasLiked);
    const [isLoading, setIsLoading] = useState<boolean>(false);

    const handleLike = async (): Promise<void> => {
        if (isLoading) return;

        setIsLoading(true);
        try {
            const response = await http(`/like/${postId}`, { method: 'POST' });

            if (response.status === 200) {
                const data = response.data;
                setCount(data.count_likes);
                setLiked(data.has_liked);
            }
        } catch {
            // Error is already handled by setting isLoading to false
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <button
            onClick={handleLike}
            className={styles.likeButton}
            disabled={isLoading}>
            <i className={`fas fa-heart ${styles.icon} ${liked ? styles.liked : ''}`} />
            <span className={styles.count}>{count}</span>
        </button>
    );
};

export default LikeButton;
