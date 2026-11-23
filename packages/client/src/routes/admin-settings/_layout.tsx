import { createFileRoute } from '@tanstack/react-router';
import { SettingsLayout } from '~/features/settings/layout/SettingsLayout';

export const Route = createFileRoute('/admin-settings/_layout')({ component: SettingsLayout });
