import { createFileRoute, redirect } from '@tanstack/react-router';
import { defaultAdminPath } from '~/features/settings/access';

export const Route = createFileRoute('/admin-settings/_layout/')({
    beforeLoad: ({ context }) => {
        throw redirect({
            to: defaultAdminPath(context.adminCapabilities),
            replace: true
        });
    }
});
