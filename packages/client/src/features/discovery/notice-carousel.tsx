import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { SiteIcon } from '../../appearance/icons.js';
import { ui } from '../../i18n/public-ui.js';
import type { NoticeSlide } from './discovery-page-data';
import { NoticeControls } from './notice-controls.js';

const autoplayMs = 5000;
const slideClass =
    'group block rounded-2xl border border-line/50 bg-transparent px-5 py-4 transition-colors duration-150 hover:border-line/70 active:bg-surface-subtle/40';

function NoticeSlideBody({ title, position }: { title: string; position: string | null }) {
    return (
        <div className="flex items-center gap-4">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface-subtle text-content-secondary">
                <SiteIcon name="speakerphone" className="text-sm" />
            </div>
            <div className="min-w-0 flex-1">
                <div className="mb-1.5 flex items-center gap-2">
                    <span className="rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wider text-content-hint">
                        {ui('Site notice')}
                    </span>
                    {position ? (
                        <span className="text-[10px] font-medium tabular-nums text-content-hint">{position}</span>
                    ) : null}
                </div>
                <h2 className="truncate text-base font-semibold leading-snug text-content">{title}</h2>
            </div>
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full text-content-hint">
                <SiteIcon name="arrow-right" className="text-sm" />
            </span>
        </div>
    );
}

export function NoticeCarousel({ notices }: { notices: NoticeSlide[] }) {
    const carouselRef = useRef<HTMLElement>(null);
    const [selected, setSelected] = useState(0);
    // The server and the first browser render show every notice, so they stay readable without JavaScript.
    const [interactive, setInteractive] = useState(false);
    const count = notices.length;
    const current = selected % count;
    const rotates = count > 1;

    useLayoutEffect(() => {
        if (rotates) setInteractive(true);
    }, [rotates]);

    useEffect(() => {
        const carousel = carouselRef.current;
        if (!interactive || !rotates || !carousel) return;
        const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
        const listeners = new AbortController();
        const { signal } = listeners;
        let timer: number | undefined;
        let resume: number | undefined;
        const stop = () => {
            window.clearInterval(timer);
            timer = undefined;
        };
        const start = () => {
            stop();
            if (!reducedMotion.matches && !carousel.matches(':hover, :focus-within')) {
                timer = window.setInterval(() => setSelected((index) => (index + 1) % count), autoplayMs);
            }
        };
        carousel.addEventListener('pointerenter', stop, { signal });
        carousel.addEventListener('pointerleave', start, { signal });
        carousel.addEventListener('focusin', stop, { signal });
        carousel.addEventListener(
            'focusout',
            () => {
                window.clearTimeout(resume);
                resume = window.setTimeout(start, 0);
            },
            { signal }
        );
        reducedMotion.addEventListener('change', start, { signal });
        start();
        return () => {
            listeners.abort();
            stop();
            window.clearTimeout(resume);
        };
    }, [interactive, rotates, count]);

    return (
        <section ref={carouselRef} className="mb-6" aria-label={ui('Site notices')} data-notice-carousel="">
            {notices.map((notice, index) => {
                const hidden = interactive && index !== current;
                const position = rotates ? `${index + 1}/${count}` : null;
                return notice.href ? (
                    <a key={notice.id} className={slideClass} data-notice-slide="" href={notice.href} hidden={hidden}>
                        <NoticeSlideBody title={notice.title} position={position} />
                    </a>
                ) : (
                    <div key={notice.id} className={slideClass} data-notice-slide="" hidden={hidden}>
                        <NoticeSlideBody title={notice.title} position={position} />
                    </div>
                );
            })}
            {rotates ? (
                <div
                    className="mt-3 flex items-center justify-center gap-2"
                    data-notice-controls=""
                    hidden={!interactive}
                >
                    <NoticeControls
                        count={count}
                        current={current}
                        onSelect={setSelected}
                        onStep={(step) => setSelected((index) => (index + step + count) % count)}
                    />
                </div>
            ) : null}
        </section>
    );
}
