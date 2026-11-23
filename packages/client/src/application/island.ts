import type { ReactNode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';

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

/** Renders browser-only UI into an empty element the caller owns. */
export function renderIsland(container: Element, island: ReactNode, signal: AbortSignal): () => void {
    const root = createRoot(container);
    root.render(island);
    return untilAborted(signal, () => root.unmount());
}

/** Renders browser-only UI that floats over the page, such as a dialog or a notice. */
export function renderBodyIsland(island: ReactNode, signal: AbortSignal): () => void {
    const host = document.createElement('div');
    document.body.append(host);
    const unmount = renderIsland(host, island, signal);
    return untilAborted(signal, () => {
        unmount();
        host.remove();
    });
}
