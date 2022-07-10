import { postReportError } from '@modules/api';

import { authStore } from '@stores/auth';

export function bindErrorReport() {
    if (typeof window !== 'undefined') {
        window.onerror = (e) => {
            const { pathname: path } = window.location;
            postReportError({
                user: authStore.state.username,
                path,
                content: JSON.stringify(e)
            });
        };
    }
}
