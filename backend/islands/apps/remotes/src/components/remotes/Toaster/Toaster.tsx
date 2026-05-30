import type { CSSProperties } from 'react';
import { Toaster as SonnerToaster } from '@blex/ui/toast';
import { useResolvedTheme } from '~/hooks/useResolvedTheme';

const toasterStyle = {
    '--normal-bg': 'var(--color-surface-elevated)',
    '--normal-bg-hover': 'var(--color-surface-subtle)',
    '--normal-border': 'var(--color-line)',
    '--normal-border-hover': 'var(--color-line-strong)',
    '--normal-text': 'var(--color-content)',
    '--success-bg': 'var(--color-success-surface)',
    '--success-border': 'var(--color-success-line)',
    '--success-text': 'var(--color-success)',
    '--info-bg': 'var(--color-surface-elevated)',
    '--info-border': 'var(--color-line-strong)',
    '--info-text': 'var(--color-content)',
    '--warning-bg': 'var(--color-warning-surface)',
    '--warning-border': 'var(--color-warning-line)',
    '--warning-text': 'var(--color-warning)',
    '--error-bg': 'var(--color-danger-surface)',
    '--error-border': 'var(--color-danger-line)',
    '--error-text': 'var(--color-danger)'
} as CSSProperties;

const Toaster = () => {
    const theme = useResolvedTheme();

    return (
        <SonnerToaster
            theme={theme}
            position="top-center"
            expand={false}
            richColors
            closeButton
            style={toasterStyle}
        />
    );
};

export default Toaster;
