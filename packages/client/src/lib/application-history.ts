import { createBrowserHistory, type RouterHistory } from '@tanstack/react-router';

declare global {
    interface Window {
        blexHistory?: RouterHistory;
    }
}

/** The public app and React screens share one history so blockers and back navigation see every move. */
export const applicationHistory = () => {
    window.blexHistory ??= createBrowserHistory();
    return window.blexHistory;
};
