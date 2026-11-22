import type { ComponentProps } from 'react';
import { ConfirmProvider } from '~/contexts/ConfirmContext';
import SettingsApp from './SettingsApp';

const SettingsAppWithConfirm = (props: ComponentProps<typeof SettingsApp>) => (
    <ConfirmProvider>
        <SettingsApp {...props} />
    </ConfirmProvider>
);

export default SettingsAppWithConfirm;
