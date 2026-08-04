import { Calendar } from '@blex/ui/icons';
import { Trans, useLingui } from '@lingui/react/macro';
import { normalizeLocale } from '~/i18n/locale';
import { formatScheduleDateTime } from '../utils/scheduleDate';

interface ScheduleStatusNoticeProps {
    value: string;
}

const ScheduleStatusNotice = ({ value }: ScheduleStatusNoticeProps) => {
    const { i18n } = useLingui();

    if (!value) return null;

    return (
        <div className="mb-4 rounded-xl border border-line bg-surface-subtle px-4 py-3 text-sm text-content-secondary">
            <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 shrink-0 text-content-hint" />
                <span className="font-medium text-content">
                    <Trans id="editor.schedule.scheduled_publish">Scheduled publish</Trans>
                </span>
                <span className="min-w-0 truncate">
                    {formatScheduleDateTime(value, normalizeLocale(i18n.locale))}
                </span>
            </div>
        </div>
    );
};

export default ScheduleStatusNotice;
