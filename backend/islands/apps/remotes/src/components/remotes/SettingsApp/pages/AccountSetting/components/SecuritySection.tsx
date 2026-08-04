import { Trans, useLingui } from '@lingui/react/macro';
import { AlertTriangle, ShieldCheck, Trash2 } from '@blex/ui/icons';
import { Button, Card } from '~/components/shared';

interface SecuritySectionProps {
    has2fa: boolean;
    onToggle2FA: (enable: boolean) => Promise<void>;
    onDeleteAccount: () => Promise<void>;
}

const SecuritySection = ({ has2fa, onToggle2FA, onDeleteAccount }: SecuritySectionProps) => {
    const { t } = useLingui();

    return (
        <>
            <Card
                title={t({
                    id: 'settings.account.security.title',
                    message: 'Security'
                })}
                icon={<ShieldCheck className="h-5 w-5" />}
                className="mb-6">
                <div className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <p className="font-medium text-content">
                            <Trans id="settings.account.two_factor.title">
                                Two-factor authentication
                            </Trans>
                        </p>
                    </div>
                    <Button
                        density="compact"
                        variant="primary"
                        size="sm"
                        className="min-h-11! self-end [@media(pointer:fine)]:min-h-9! sm:self-auto"
                        onClick={() => onToggle2FA(!has2fa)}>
                        {has2fa
                            ? t({
                                id: 'common.disable',
                                message: 'Disable'
                            })
                            : t({
                                id: 'common.enable',
                                message: 'Enable'
                            })}
                    </Button>
                </div>
            </Card>

            <section
                aria-labelledby="danger-zone-title"
                className="rounded-2xl border border-danger-line bg-danger-surface/40 p-6 md:p-8">
                <div className="flex items-center gap-3 text-danger">
                    <AlertTriangle className="h-5 w-5" />
                    <h3 id="danger-zone-title" className="text-base font-semibold">
                        <Trans id="settings.account.danger_zone">Danger zone</Trans>
                    </h3>
                </div>
                <div className="mt-6 flex flex-col gap-4 border-t border-danger-line pt-6 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                        <p className="font-medium text-content">
                            <Trans id="settings.account.delete.title">Delete account</Trans>
                        </p>
                        <p className="text-sm text-content-secondary">
                            <Trans id="settings.account.delete.description">
                                All data will be permanently deleted and cannot be recovered.
                            </Trans>
                        </p>
                    </div>
                    <Button
                        density="compact"
                        variant="danger"
                        size="sm"
                        className="min-h-11! shrink-0 self-end [@media(pointer:fine)]:min-h-9! sm:self-auto"
                        leftIcon={<Trash2 className="h-4 w-4" />}
                        onClick={onDeleteAccount}>
                        <Trans id="common.delete">Delete</Trans>
                    </Button>
                </div>
            </section>
        </>
    );
};

export default SecuritySection;
