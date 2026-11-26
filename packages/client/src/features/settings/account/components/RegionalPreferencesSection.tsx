import { useState, type FormEvent } from 'react';
import { Trans, useLingui } from '@lingui/react/macro';
import { Clock } from '~/ui/icons';
import { Button, Card } from '~/components/shared';
import { updateRegionalPreferences, type RegionalPreferences } from '~/lib/api/settings';

interface RegionalPreferencesSectionProps {
    preferences: RegionalPreferences;
}

const selectClassName =
    'mt-2 min-h-12 w-full rounded-lg border border-line bg-surface px-3 text-content focus:border-content-hint focus:outline-hidden focus:ring-1 focus:ring-content-hint';

const RegionalPreferencesSection = ({ preferences }: RegionalPreferencesSectionProps) => {
    const { t } = useLingui();
    const [language, setLanguage] = useState(preferences.language);
    const [timeZone, setTimeZone] = useState(preferences.timeZone);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');
    const defaultLanguageLabel =
        preferences.languages.find(({ code }) => code === preferences.defaultLanguage)?.label ||
        preferences.defaultLanguage;

    const save = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setIsSaving(true);
        setError('');
        try {
            const { data } = await updateRegionalPreferences(language, timeZone);
            if (data.status === 'DONE') {
                window.location.reload();
                return;
            }
            setError(
                data.errorMessage ||
                    t({
                        id: 'settings.regional_preferences.save_failed',
                        message: 'Could not save your regional preferences.'
                    })
            );
        } catch {
            setError(
                t({
                    id: 'common.network_error',
                    message: 'A network error occurred.'
                })
            );
        }
        setIsSaving(false);
    };

    return (
        <Card
            title={t({
                id: 'settings.regional_preferences.title',
                message: 'Language and time zone'
            })}
            icon={<Clock className="h-5 w-5" />}
            className="mb-6"
        >
            <form onSubmit={save}>
                <fieldset disabled={isSaving} className="grid gap-4 sm:grid-cols-2">
                    <label className="min-w-0 text-sm font-medium text-content-secondary">
                        <Trans id="settings.regional_preferences.language">Language</Trans>
                        <select
                            className={selectClassName}
                            value={language ?? ''}
                            onChange={(event) => setLanguage(event.target.value)}
                        >
                            <option value="">
                                <Trans id="settings.regional_preferences.site_default">
                                    Site default ({defaultLanguageLabel})
                                </Trans>
                            </option>
                            {preferences.languages.map(({ code, label }) => (
                                <option key={code} value={code}>
                                    {label}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label className="min-w-0 text-sm font-medium text-content-secondary">
                        <Trans id="settings.regional_preferences.time_zone">Time zone</Trans>
                        <select
                            className={selectClassName}
                            value={timeZone}
                            onChange={(event) => setTimeZone(event.target.value)}
                        >
                            <option value="">
                                <Trans id="settings.regional_preferences.site_default_time_zone">
                                    Site default ({preferences.defaultTimeZone})
                                </Trans>
                            </option>
                            {preferences.timeZones.map((zone) => (
                                <option key={zone} value={zone}>
                                    {zone.replace(/_/g, ' ')}
                                </option>
                            ))}
                        </select>
                    </label>
                </fieldset>
                {error && (
                    <p role="alert" className="mt-3 text-sm text-danger">
                        {error}
                    </p>
                )}
                <div className="mt-4 flex justify-end">
                    <Button
                        type="submit"
                        density="compact"
                        variant="primary"
                        isLoading={isSaving}
                        disabled={isSaving || (language === preferences.language && timeZone === preferences.timeZone)}
                    >
                        <Trans id="common.save">Save</Trans>
                    </Button>
                </div>
            </form>
        </Card>
    );
};

export default RegionalPreferencesSection;
