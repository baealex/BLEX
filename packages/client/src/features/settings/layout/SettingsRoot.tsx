import { Outlet } from '@tanstack/react-router';
import { Suspense, useEffect } from 'react';
import { useLingui } from '@lingui/react/macro';
import { LoadingState } from '~/components/shared';
import { useSettingsMode } from '../settings-mode';

const SettingsDocumentTitle = () => {
    const settingsMode = useSettingsMode();

    useEffect(() => {
        const label = settingsMode === 'admin' ? '관리자 설정' : '설정';
        document.title = document.title.replace(/^(?:관리자 설정|설정)(?= \|)/, label);
    }, [settingsMode]);

    return null;
};

export const SettingsRoot = () => {
    const { t } = useLingui();

    return (
        <Suspense
            fallback={(
                <LoadingState
                    type="form"
                    ariaLabel={t({
                        id: 'common.loading',
                        message: 'Loading'
                    })}
                />
            )}>
            <SettingsDocumentTitle />
            <Outlet />
        </Suspense>
    );
};
