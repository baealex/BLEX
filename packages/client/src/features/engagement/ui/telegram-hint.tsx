import { ui } from '../../../i18n/public-ui.js';
import IconBrandTelegram from '@tabler/icons-react/icons/IconBrandTelegram';
import IconX from '@tabler/icons-react/icons/IconX';
import { useEffect } from 'react';
import { ENTRANCE_DURATION, INTERACTION_DURATION } from '../../../ui/lib/designTokens';

const cookieName = 'blex_telegram_hint';
const storagePrefix = 'blex:subscription-telegram-hint-shown:';
// The one brand color on the card. It stays readable on both light and dark surfaces.
const telegramBlue = '#007dbb';
const pressable = `transition-colors ${INTERACTION_DURATION} active:scale-95`;

/** The server leaves a short-lived note on the subscribe redirect. Reading it once also clears it. */
function takeHintUsername(): string {
    const entry = document.cookie.split('; ').find((item) => item.startsWith(`${cookieName}=`));
    if (!entry) return '';
    const secure = location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${cookieName}=; Path=/; Max-Age=0; SameSite=Lax${secure}`;
    try {
        return decodeURIComponent(entry.slice(cookieName.length + 1));
    } catch {
        return '';
    }
}

/** Reserves the single showing for this account, and stays quiet when the browser cannot remember it. */
function claimShowing(username: string): boolean {
    if (!username) return false;
    const key = `${storagePrefix}${username}`;
    try {
        if (localStorage.getItem(key)) return false;
        localStorage.setItem(key, new Date().toISOString());
        return true;
    } catch {
        return false;
    }
}

export interface TelegramHintProps {
    raised: boolean;
    onClose: () => void;
}

/** Reads the server's note and reserves its single showing. */
export function claimTelegramHint(): boolean {
    return claimShowing(takeHintUsername());
}

export function TelegramHint({ raised, onClose }: TelegramHintProps) {
    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [onClose]);

    return (
        <div
            id="blex-subscription-telegram-hint-root"
            className="pointer-events-none fixed inset-x-0 z-40 flex justify-end px-4 sm:px-6"
            style={{ bottom: `calc(${raised ? '7rem' : '1.5rem'} + env(safe-area-inset-bottom))` }}
        >
            <aside
                role="status"
                aria-live="polite"
                aria-label={ui('Telegram connection reminder')}
                className={`pointer-events-auto relative w-full max-w-[22rem] rounded-2xl border border-line bg-surface-elevated p-4 text-content shadow-floating animate-in fade-in-0 ${ENTRANCE_DURATION}`}
            >
                <button
                    type="button"
                    aria-label={ui('Close')}
                    onClick={onClose}
                    className={`absolute right-1.5 top-1.5 inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-content-hint hover:bg-surface-subtle hover:text-content ${pressable} [@media(pointer:fine)]:min-h-8 [@media(pointer:fine)]:min-w-8`}
                >
                    <IconX className="h-4 w-4" aria-hidden="true" />
                </button>
                <div className="flex items-center gap-3 pr-8">
                    <span
                        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-subtle"
                        style={{ color: telegramBlue }}
                    >
                        <IconBrandTelegram className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                        <p className="text-sm font-semibold text-content">{ui('Subscribed')}</p>
                        <p className="mt-0.5 text-sm text-content-secondary">{ui('Get new posts on Telegram')}</p>
                    </div>
                </div>
                <div className="mt-3 flex items-center justify-end gap-1">
                    <button
                        type="button"
                        onClick={onClose}
                        className={`inline-flex min-h-11 items-center justify-center rounded-lg px-3 text-sm font-medium text-content-secondary hover:bg-surface-subtle hover:text-content ${pressable} [@media(pointer:fine)]:min-h-9`}
                    >
                        {ui('Later')}
                    </button>
                    <a
                        href="/settings/integration"
                        aria-label={ui('Connect Telegram')}
                        className={`inline-flex min-h-11 items-center justify-center rounded-lg bg-action px-3.5 text-sm font-semibold text-content-inverted hover:bg-action-hover ${pressable} [@media(pointer:fine)]:min-h-9`}
                    >
                        {ui('Connect')}
                    </a>
                </div>
            </aside>
        </div>
    );
}
