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

// Check if user is logged in
const isLoggedIn = () => {
    return !!(window as any).configuration?.user?.username;
};

// Show login prompt modal
const showLoginPrompt = (action: string) => {
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in';
    modal.style.animation = 'fadeIn 0.2s ease-out';

    modal.innerHTML = `
        <div class="absolute inset-0 bg-black/40 backdrop-blur-sm" onclick="this.parentElement.remove()"></div>
        <div class="relative bg-white rounded-3xl shadow-2xl max-w-sm w-full overflow-hidden transform transition-all"
             style="animation: slideUp 0.3s cubic-bezier(0.4, 0, 0.2, 1)">
            <div class="p-8 text-center">
                <div class="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-6">
                    <svg class="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                </div>
                <h3 class="text-xl font-semibold text-gray-900 mb-2">로그인이 필요해요</h3>
                <p class="text-gray-600 mb-8">${action}을(를) 하려면 먼저 로그인해주세요.</p>
                <div class="space-y-3">
                    <a href="/login"
                       class="block w-full py-3.5 px-6 bg-gray-900 hover:bg-gray-800 text-white font-semibold rounded-xl
                              transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5">
                        로그인하기
                    </a>
                    <button onclick="this.closest('.fixed').remove()"
                            class="block w-full py-3.5 px-6 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl
                                   transition-all duration-200">
                        취소
                    </button>
                </div>
            </div>
        </div>
    `;

    // Add keyframe animations
    if (!document.getElementById('login-prompt-styles')) {
        const style = document.createElement('style');
        style.id = 'login-prompt-styles';
        style.textContent = `
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            @keyframes slideUp {
                from {
                    opacity: 0;
                    transform: translateY(20px) scale(0.95);
                }
                to {
                    opacity: 1;
                    transform: translateY(0) scale(1);
                }
            }
        `;
        document.head.appendChild(style);
    }

    document.body.appendChild(modal);
};

const likeButton = (options: LikeButtonOptions = {}): Alpine.AlpineComponent<State & Actions> => ({
    count: options.count ?? 0,
    liked: options.liked ?? false,
    loading: false,
    postUrl: options.postUrl ?? '',

    async handleLike() {
        // Check if user is logged in
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
        } finally {
            this.loading = false;
        }
    }
});

export default likeButton;
