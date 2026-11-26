import { ui } from '../../i18n/public-ui.js';
import { SiteIcon } from '../../appearance/icons.js';

const stepButtonClass =
    'touch-target relative flex size-8 items-center justify-center rounded-full text-content-hint hover:text-content-secondary';

export function NoticeControls({
    count,
    current = 0,
    onSelect,
    onStep
}: {
    count: number;
    current?: number;
    onSelect?: (index: number) => void;
    onStep?: (step: number) => void;
}) {
    return (
        <>
            <button
                type="button"
                className={stepButtonClass}
                data-notice-step="-1"
                aria-label={ui('Previous notice')}
                onClick={() => onStep?.(-1)}
            >
                <SiteIcon name="chevron-left" className="text-xs" />
            </button>
            {/* Each dot is a 44px-tall button around a small mark; the arrows beside them do the same job. */}
            <div className="flex items-center">
                {Array.from({ length: count }, (_, index) => (
                    <button
                        // biome-ignore lint/suspicious/noArrayIndexKey: a dot is its position in a list that never reorders.
                        key={index}
                        type="button"
                        className="blex-notice-dot flex h-11 items-center px-[3px]"
                        data-notice-index={index}
                        aria-label={ui('Show notice {value0}', { value0: index + 1 })}
                        aria-pressed={index === current}
                        onClick={() => onSelect?.(index)}
                    >
                        <span className="block h-1.5 rounded-full transition-colors duration-150" />
                    </button>
                ))}
            </div>
            <button
                type="button"
                className={stepButtonClass}
                data-notice-step="1"
                aria-label={ui('Next notice')}
                onClick={() => onStep?.(1)}
            >
                <SiteIcon name="chevron-right" className="text-xs" />
            </button>
        </>
    );
}
