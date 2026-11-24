import type { ReactNode } from 'react';

// Screens bring the toaster inside their own boundary. It stays across pages, so a toast outlives the move after it.
let toaster: ReactNode = null;
const listeners = new Set<() => void>();

/** Renders the toaster a screen loaded, once, beside the application's prompts. */
export function showToaster(node: ReactNode): void {
    if (toaster) return;
    toaster = node;
    for (const listener of listeners) listener();
}

export function subscribeToaster(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

export const readToaster = (): ReactNode => toaster;
