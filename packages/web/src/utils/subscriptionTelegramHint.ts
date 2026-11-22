/**
 * One-time Telegram suggestion shown right after a reader subscribes to an author.
 * The screen is mounted lazily so pages without a subscription action never load it.
 */

const HINT_ROOT_ID = 'blex-subscription-telegram-hint-root';
const HINT_STORAGE_PREFIX = 'blex:subscription-telegram-hint-shown:';

type HintStorage = Pick<Storage, 'getItem' | 'setItem'>;

/**
 * Reserve the single showing for this account.
 * Returns false when it was already used or the storage cannot remember it,
 * so the hint never repeats on every subscription.
 */
export const claimSubscriptionTelegramHint = (
    storage: HintStorage,
    viewerUsername: string
): boolean => {
    if (!viewerUsername) {
        return false;
    }

    const storageKey = `${HINT_STORAGE_PREFIX}${viewerUsername}`;

    try {
        if (storage.getItem(storageKey)) {
            return false;
        }
        storage.setItem(storageKey, new Date().toISOString());
        return true;
    } catch {
        return false;
    }
};

/**
 * Show the hint once per account. Returns true when the hint was shown,
 * letting callers skip their regular success toast.
 */
export const showSubscriptionTelegramHint = (): boolean => {
    if (typeof document === 'undefined' || typeof window === 'undefined') {
        return false;
    }

    let storage: Storage;
    try {
        storage = window.localStorage;
    } catch {
        return false;
    }

    const viewerUsername = window.configuration?.user?.username ?? '';
    if (!claimSubscriptionTelegramHint(storage, viewerUsername)) {
        return false;
    }

    document.getElementById(HINT_ROOT_ID)?.remove();

    const hint = document.createElement('div');
    hint.id = HINT_ROOT_ID;
    hint.dataset.screen = 'SubscriptionTelegramHint';
    const raised = document.querySelector('.post-action-dock') !== null;
    hint.dataset.screenProps = encodeURIComponent(JSON.stringify({ raised }));
    hint.dataset.screenStatus = 'pending';
    document.body.appendChild(hint);

    return true;
};
