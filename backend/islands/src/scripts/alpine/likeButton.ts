import type Alpine from 'alpinejs';

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
        if (this.loading || !this.postUrl) return;
        this.loading = true;

        try {
            const response = await fetch(`/like/${this.postUrl}`, {
                method: 'POST',
                headers: {
                    'X-CSRFToken': document.querySelector('[name=csrfmiddlewaretoken]')?.value || '',
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
        } finally {
            this.loading = false;
        }
    }
});

export default likeButton;
