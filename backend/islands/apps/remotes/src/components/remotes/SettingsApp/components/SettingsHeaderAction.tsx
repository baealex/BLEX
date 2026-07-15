import type { ComponentProps } from 'react';
import { Button } from '~/components/shared';

type SettingsHeaderActionProps = Omit<ComponentProps<typeof Button>, 'size'>;

const SettingsHeaderAction = ({
    className = '',
    ...props
}: SettingsHeaderActionProps) => {
    return (
        <Button
            density="compact"
            {...props}
            size="sm"
            className={`min-h-11! w-auto [@media(pointer:fine)]:min-h-9! ${className}`}
        />
    );
};

export default SettingsHeaderAction;
