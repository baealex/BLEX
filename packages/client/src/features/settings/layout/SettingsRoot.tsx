import { ui } from '../../../i18n/public-ui.js';
import { Outlet } from '@tanstack/react-router';
import { Suspense, useEffect } from 'react';
import { useLingui } from '@lingui/react/macro';
import { LoadingState } from '~/components/shared';
import { useSettingsMode } from '../settings-mode';

const SettingsDocumentTitle = () => {
    const settingsMode = useSettingsMode();

    useEffect(() => {
        const label = settingsMode === 'admin' ? ui('Admin settings') : ui('Settings');
        document.title = document.title.replace(/^(?:관리자 설정|설정|Admin settings|Settings)(?= \|)/, label);
    }, [settingsMode]);

    return null;
};

export const SettingsRoot = () => {
    const { t } = useLingui();

    return (
        <Suspense
            fallback={
                <LoadingState
                    type="form"
                    ariaLabel={t({
                        id: 'common.loading',
                        message: 'Loading'
                    })}
                />
            }
        >
            <SettingsDocumentTitle />
            <Outlet />
        </Suspense>
    );
};
