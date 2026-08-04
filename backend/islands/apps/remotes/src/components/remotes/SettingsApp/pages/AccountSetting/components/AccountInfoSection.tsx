import { Trans, useLingui } from '@lingui/react/macro';
import { BadgeInfo } from '@blex/ui/icons';
import { Card } from '~/components/shared';
import { formatDateOnly } from '~/i18n/formatters';
import { normalizeLocale } from '~/i18n/locale';

interface AccountInfoSectionProps {
    createdDate: string;
    email: string;
}

const AccountInfoSection = ({ createdDate, email }: AccountInfoSectionProps) => {
    const { i18n, t } = useLingui();

    return (
        <Card
            title={t({
                id: 'settings.account.info.title',
                message: 'Account information'
            })}
            icon={<BadgeInfo className="h-5 w-5" />}
            className="mb-6">
            <dl className="divide-y divide-line">
                <div className="grid gap-1 pb-4 sm:grid-cols-[8rem_minmax(0,1fr)] sm:items-center sm:gap-4">
                    <dt className="text-sm font-medium text-content-secondary">
                        <Trans id="settings.account.info.joined">Joined</Trans>
                    </dt>
                    <dd className="text-sm text-content sm:text-right">
                        {formatDateOnly(
                            createdDate,
                            normalizeLocale(i18n.locale),
                            createdDate
                        )}
                    </dd>
                </div>
                <div className="grid gap-1 pt-4 sm:grid-cols-[8rem_minmax(0,1fr)] sm:items-center sm:gap-4">
                    <dt className="text-sm font-medium text-content-secondary">
                        <Trans id="settings.account.info.email">Email</Trans>
                    </dt>
                    <dd className="break-all text-sm text-content sm:text-right">{email}</dd>
                </div>
            </dl>
        </Card>
    );
};

export default AccountInfoSection;
