import { useEffect, useState } from 'react';
import { Trans, useLingui } from '@lingui/react/macro';
import {
    Check,
    X,
    BrandTelegram
} from '@blex/ui/icons';
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
                <BrandTelegram aria-hidden="true" className="pointer-events-none absolute bottom-4 right-4 h-20 w-20 text-white" />

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
