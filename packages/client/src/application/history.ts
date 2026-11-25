import { createBrowserHistory, type RouterHistory } from '@tanstack/react-router';

// Not a window global: an element in authored HTML with the same id would stand in for it.
let shared: RouterHistory | undefined;

/** The application and its screens share one history, so unsaved-change blockers also cover links in the site header. */
export function applicationHistory(): RouterHistory {
    shared ??= createBrowserHistory();
    return shared;
}
