import { RouterProvider } from '@tanstack/react-router';
import { useState } from 'react';
import { createClientRouter } from '~/router';
import { settingsRouterContext, type SettingsAppProps } from './access';

const SettingsApp = (props: SettingsAppProps) => {
    const [router] = useState(() => createClientRouter(settingsRouterContext(props)));

    return <RouterProvider router={router} />;
};

export default SettingsApp;
