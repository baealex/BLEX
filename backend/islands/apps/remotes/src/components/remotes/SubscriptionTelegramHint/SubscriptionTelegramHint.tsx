import { useEffect, useState } from 'react';
import { Trans, useLingui } from '@lingui/react/macro';
import { Check, X } from '@blex/ui/icons';
import { ENTRANCE_DURATION, INTERACTION_DURATION } from '~/components/shared';

interface SubscriptionTelegramHintProps {
    /** Sit above the floating post action bar on post pages. */
    raised?: boolean;
}

/*
 * Telegram brand blue, deepened just enough to keep small white text above 4.5:1 contrast.
 * This card promotes Telegram, so it intentionally steps outside the monochrome palette.
 * One-off values are inline styles: the base stylesheet has almost no budget left,
 * and arbitrary Tailwind values would add rules to every page.
 */
const TELEGRAM_BLUE = '#007dbb';

/*
 * Paper plane from the Font Awesome Free 7.3.0 "telegram" brand icon (CC BY 4.0),
 * without the surrounding circle.
 */
const TELEGRAM_PLANE_PATH = 'M371 176.7c-3.7 39.2-19.9 134.4-28.1 178.3-3.5 18.6-10.3 24.8-16.9 25.4-14.4 1.3-25.3-9.5-39.3-18.7-21.8-14.3-34.2-23.2-55.3-37.2-24.5-16.1-8.6-25 5.3-39.5 3.7-3.8 67.1-61.5 68.3-66.7 .2-.7 .3-3.1-1.2-4.4s-3.6-.8-5.1-.5c-2.2 .5-37.1 23.5-104.6 69.1-9.9 6.8-18.9 10.1-26.9 9.9-8.9-.2-25.9-5-38.6-9.1-15.5-5-27.9-7.7-26.8-16.3 .6-4.5 6.7-9 18.4-13.7 72.3-31.5 120.5-52.3 144.6-62.3 68.9-28.6 83.2-33.6 92.5-33.8 2.1 0 6.6 .5 9.6 2.9 2 1.7 3.2 4.1 3.5 6.7 .5 3.2 .6 6.5 .4 9.8z';

const SubscriptionTelegramHint = ({ raised = false }: SubscriptionTelegramHintProps) => {
    const { t } = useLingui();
    const [isOpen, setIsOpen] = useState(true);

    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setIsOpen(false);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen]);

    if (!isOpen) {
        return null;
    }

    const bottomOffset = raised
        ? 'calc(7rem + env(safe-area-inset-bottom))'
        : 'calc(1.5rem + env(safe-area-inset-bottom))';

    return (
        <div
            className="pointer-events-none fixed inset-x-0 z-40 flex justify-end px-4 sm:px-6"
            style={{ bottom: bottomOffset }}>
            <aside
                role="status"
                aria-live="polite"
                aria-label={t({
                    id: 'subscription_telegram_hint.aria_label',
                    message: 'Telegram suggestion'
                })}
                className={`pointer-events-auto relative w-full max-w-sm overflow-hidden rounded-2xl p-6 text-white shadow-floating animate-in fade-in-0 ${ENTRANCE_DURATION}`}
                style={{ backgroundColor: TELEGRAM_BLUE }}>
                <svg
                    aria-hidden="true"
                    viewBox="96 136 280 250"
                    className="pointer-events-none absolute bottom-4 right-4 h-20 w-20 text-white">
                    <path fill="currentColor" d={TELEGRAM_PLANE_PATH} />
                </svg>

                <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    aria-label={t({
                        id: 'subscription_telegram_hint.close',
                        message: 'Close'
                    })}
                    className={`absolute right-3 top-3 inline-flex min-h-11 min-w-11 items-center justify-center rounded-full text-white/85 transition-opacity ${INTERACTION_DURATION} hover:opacity-80 active:scale-95 [@media(pointer:fine)]:min-h-9 [@media(pointer:fine)]:min-w-9`}>
                    <X aria-hidden="true" className="h-4 w-4" />
                </button>

                <div className="relative pr-20">
                    <p className="flex items-center gap-1.5 text-sm font-semibold text-white">
                        <Check aria-hidden="true" className="h-4 w-4" />
                        <Trans id="subscription_telegram_hint.title">Subscribed</Trans>
                    </p>
                    <p className="mt-3 text-2xl font-bold leading-tight tracking-tight">
                        <Trans id="subscription_telegram_hint.headline">Get new posts on Telegram</Trans>
                    </p>
                </div>

                <div className="relative mt-5 flex items-center gap-1">
                    <a
                        href="/settings/integration"
                        className={`inline-flex min-h-11 items-center justify-center rounded-lg bg-white px-4 text-sm font-bold transition-opacity ${INTERACTION_DURATION} hover:opacity-80 active:scale-95 [@media(pointer:fine)]:min-h-10`}
                        style={{ color: TELEGRAM_BLUE }}>
                        <Trans id="subscription_telegram_hint.connect">Connect Telegram</Trans>
                    </a>
                    <button
                        type="button"
                        onClick={() => setIsOpen(false)}
                        className={`inline-flex min-h-11 items-center justify-center rounded-lg px-3.5 text-sm font-semibold text-white transition-opacity ${INTERACTION_DURATION} hover:opacity-80 active:scale-95 [@media(pointer:fine)]:min-h-10`}>
                        <Trans id="subscription_telegram_hint.later">Later</Trans>
                    </button>
                </div>
            </aside>
        </div>
    );
};

export default SubscriptionTelegramHint;
