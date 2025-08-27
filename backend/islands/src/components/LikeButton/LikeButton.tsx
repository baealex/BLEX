import { useState } from 'react';
import { http } from '~/modules/http.module';

interface LikeButtonProps {
    postId: string;
    likesCount: number;
    hasLiked: boolean;
    size?: 'small' | 'normal';
}

const LikeButton = ({ postId, likesCount, hasLiked, size = 'normal' }: LikeButtonProps) => {
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
            className={`
                inline-flex items-center justify-center gap-1.5
                border-0 rounded-lg font-medium
                transition-all duration-200
                outline-none cursor-pointer
                ${size === 'small'
                    ? 'px-3 py-2.5 sm:py-2 min-h-[44px] sm:min-h-auto text-sm'
                    : 'px-3 py-1 rounded-3xl text-sm'
                }
                ${liked
                    ? 'bg-red-50 text-red-600 hover:bg-red-100'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }
                ${isLoading ? 'opacity-70 cursor-not-allowed' : 'active:scale-95'}
            `}
            disabled={isLoading}>
            <i className={`fas fa-heart ${liked ? 'text-red-600' : 'text-gray-600'}`} />
            <span>{count}</span>
        </button>
    );
};

export default LikeButton;
