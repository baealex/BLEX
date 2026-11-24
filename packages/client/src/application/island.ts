import type { ReactNode } from 'react';
import { hydrateRoot } from 'react-dom/client';

/** Runs `dispose` once, on the page change that aborts `signal` or when the returned function is called. */
function untilAborted(signal: AbortSignal, dispose: () => void): () => void {
    let active = true;
    const stop = () => {
        if (!active) return;
        active = false;
        signal.removeEventListener('abort', stop);
        dispose();
    };
    signal.addEventListener('abort', stop, { once: true });
    return stop;
}

/**
 * Takes over server markup inside `container`.
 * Unmounting puts that markup back, because a navigation to identical HTML keeps the existing DOM.
 */
export function hydrateIsland(container: Element, island: ReactNode, signal: AbortSignal): () => void {
    const serverMarkup = Array.from(container.childNodes, (node) => node.cloneNode(true));
    const root = hydrateRoot(container, island);
    return untilAborted(signal, () => {
        root.unmount();
        container.replaceChildren(...serverMarkup);
    });
}
