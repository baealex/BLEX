import { useEffect, useLayoutEffect, useState } from 'react';
import { hydrateIsland } from '../../application/island.js';
import { NoticeControls } from './notice-controls.js';

const autoplayMs = 5000;

/** Slides stay server HTML for search visibility, so React owns the controls and only toggles the slides. */
function NoticeCarousel({
    carousel,
    controls,
    slides
}: {
    carousel: HTMLElement;
    controls: HTMLElement;
    slides: HTMLElement[];
}) {
    const [current, setCurrent] = useState(0);
    const count = slides.length;

    useLayoutEffect(() => {
        slides.forEach((slide, position) => {
            slide.hidden = position !== current;
        });
    }, [slides, current]);

    useEffect(() => {
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
                timer = window.setInterval(() => setCurrent((index) => (index + 1) % count), autoplayMs);
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
        controls.hidden = false;
        start();
        return () => {
            listeners.abort();
            stop();
            window.clearTimeout(resume);
        };
    }, [carousel, controls, count]);

    return (
        <NoticeControls
            count={count}
            current={current}
            onSelect={setCurrent}
            onStep={(step) => setCurrent((index) => (index + step + count) % count)}
        />
    );
}

export function mountNoticeCarousels(signal: AbortSignal): void {
    for (const carousel of document.querySelectorAll<HTMLElement>('[data-notice-carousel]')) {
        const slides = [...carousel.querySelectorAll<HTMLElement>('[data-notice-slide]')];
        const controls = carousel.querySelector<HTMLElement>('[data-notice-controls]');
        if (!controls || slides.length < 2) continue;
        hydrateIsland(controls, <NoticeCarousel carousel={carousel} controls={controls} slides={slides} />, signal);
    }
}
