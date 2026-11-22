import type Alpine from 'alpinejs';
import { isLoggedIn, showLoginPrompt } from '~/utils/loginPrompt';
import { showSubscriptionTelegramHint } from '~/utils/subscriptionTelegramHint';

interface SubscribeButtonOptions {
    username?: string;
    subscribed?: boolean;
    subscribedMessage?: string;
    unsubscribedMessage?: string;
    errorMessage?: string;
}

interface State {
    username: string;
    subscribed: boolean;
    loading: boolean;
    subscribedMessage: string;
    unsubscribedMessage: string;
    errorMessage: string;
}

interface Actions {
    toggleSubscription(): Promise<void>;
}

interface SubscriptionResponse {
    status: 'DONE' | 'ERROR';
    body?: {
        isSubscribed?: boolean;
        suggestTelegramConnection?: boolean;
    };
    errorMessage?: string;
}

const getCsrfToken = () => {
    const tokenInput = document.querySelector<HTMLInputElement>('[name=csrfmiddlewaretoken]');
    if (tokenInput?.value) {
        return tokenInput.value;
    }

    return document.cookie
        .split('; ')
        .find(cookie => cookie.startsWith('csrftoken='))
        ?.split('=')[1] ?? '';
};

const subscribeButton = (options: SubscribeButtonOptions = {}): Alpine.AlpineComponent<State & Actions> => ({
    username: options.username ?? '',
    subscribed: options.subscribed ?? false,
    loading: false,
    subscribedMessage: options.subscribedMessage ?? 'Subscribed. You will be notified about new posts.',
    unsubscribedMessage: options.unsubscribedMessage ?? 'Unsubscribed.',
    errorMessage: options.errorMessage ?? 'Could not update the subscription. Please try again.',

    async toggleSubscription() {
        if (!isLoggedIn()) {
            showLoginPrompt('subscribe');
            return;
        }

        if (this.loading || !this.username) return;
        this.loading = true;

        try {
            const response = await fetch(`/v1/users/@${encodeURIComponent(this.username)}/subscription`, {
                method: this.subscribed ? 'DELETE' : 'POST',
                headers: { 'X-CSRFToken': getCsrfToken() }
            });
            const data = await response.json() as SubscriptionResponse;

            if (data.status === 'DONE') {
                this.subscribed = data.body?.isSubscribed ?? !this.subscribed;
                if (
                    this.subscribed
                    && data.body?.suggestTelegramConnection
                    && showSubscriptionTelegramHint()
                ) {
                    return;
                }
                window.toast.success(this.subscribed ? this.subscribedMessage : this.unsubscribedMessage);
                return;
            }

            window.toast.error(data.errorMessage || this.errorMessage);
        } catch (error) {
            console.error('Subscription update failed:', error);
            window.toast.error(this.errorMessage);
        } finally {
            this.loading = false;
        }
    }
});

export default subscribeButton;
