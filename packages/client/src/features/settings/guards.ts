import { redirect } from '@tanstack/react-router';
import { defaultAdminPath, type AdminCapabilities, type SettingsRouterContext } from './access';

interface GuardArguments {
    context: SettingsRouterContext;
}

export const requireEditor = ({ context }: GuardArguments): void => {
    if (!context.isEditor)
        throw redirect({
            to: '/settings/notify',
            replace: true
        });
};

export const requireTelegramIntegration = ({ context }: GuardArguments): void => {
    if (!context.canUseTelegramIntegration)
        throw redirect({
            to: '/settings/notify',
            replace: true
        });
};

export const requireAdminCapability =
    (capability: keyof AdminCapabilities) =>
    ({ context }: GuardArguments): void => {
        if (!context.isStaff)
            throw redirect({
                to: '/settings/notify',
                replace: true
            });
        if (!context.adminCapabilities[capability])
            throw redirect({
                to: defaultAdminPath(context.adminCapabilities),
                replace: true
            });
    };
