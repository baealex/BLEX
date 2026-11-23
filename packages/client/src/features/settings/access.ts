export interface AdminCapabilities {
    canManageSiteSettings: boolean;
    canManageLoginSettings: boolean;
    canManageIntegrationSettings: boolean;
    canManageUtilities: boolean;
}

export interface SettingsAppProps {
    isEditor: boolean;
    isStaff: boolean;
    isSuperuser?: boolean;
    canUseTelegramIntegration?: boolean;
    adminCapabilities?: Partial<AdminCapabilities>;
}

export interface SettingsRouterContext {
    isEditor: boolean;
    isStaff: boolean;
    canUseTelegramIntegration: boolean;
    adminCapabilities: AdminCapabilities;
}

export const settingsRouterContext = ({
    isEditor,
    isStaff,
    isSuperuser = false,
    canUseTelegramIntegration = false,
    adminCapabilities
}: SettingsAppProps): SettingsRouterContext => {
    const legacyStaffCapabilities = adminCapabilities === undefined && isStaff;
    const can = (capability: keyof AdminCapabilities) => (
        isSuperuser || adminCapabilities?.[capability] === true || legacyStaffCapabilities
    );

    return {
        isEditor,
        isStaff,
        canUseTelegramIntegration,
        adminCapabilities: {
            canManageSiteSettings: can('canManageSiteSettings'),
            canManageLoginSettings: can('canManageLoginSettings'),
            canManageIntegrationSettings: can('canManageIntegrationSettings'),
            canManageUtilities: can('canManageUtilities')
        }
    };
};

export const defaultAdminPath = (adminCapabilities: AdminCapabilities) => {
    if (adminCapabilities.canManageSiteSettings) return '/admin-settings/site-settings' as const;
    if (adminCapabilities.canManageLoginSettings) return '/admin-settings/login' as const;
    if (adminCapabilities.canManageIntegrationSettings) return '/admin-settings/integrations' as const;
    return '/admin-settings/global-notices' as const;
};
