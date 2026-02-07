import type Alpine from 'alpinejs';
import { isLoggedIn, showLoginPrompt } from '~/utils/loginPrompt';

interface LikeButtonOptions {
    count?: number;
    liked?: boolean;
    postUrl?: string;
}

interface State {
    count: number;
    liked: boolean;
    loading: boolean;
    postUrl: string;
}

interface Actions {
    handleLike(): Promise<void>;
}

const likeButton = (options: LikeButtonOptions = {}): Alpine.AlpineComponent<State & Actions> => ({
    count: options.count ?? 0,
    liked: options.liked ?? false,
    loading: false,
    postUrl: options.postUrl ?? '',

    async handleLike() {
        if (!isLoggedIn()) {
            showLoginPrompt('좋아요');
            return;
        }

        if (this.loading || !this.postUrl) return;
        this.loading = true;

        try {
            const csrfTokenInput = document.querySelector('[name=csrfmiddlewaretoken]') as HTMLInputElement;
            const response = await fetch(`/like/${this.postUrl}`, {
                method: 'POST',
                headers: {
                    'X-CSRFToken': csrfTokenInput.value || '',
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.count = data.count_likes;
                this.liked = data.has_liked;
            }
        } catch (error) {
            console.error('Like failed:', error);
            window.toast.error('좋아요 처리에 실패했습니다');
        } finally {
            this.loading = false;
        }
    }
});

export default likeButton;
