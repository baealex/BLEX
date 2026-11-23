import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/settings/_layout/')({
    beforeLoad: () => {
        throw redirect({
            to: '/settings/notify',
            replace: true
        });
    }
});
