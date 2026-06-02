import { Calendar } from '@blex/ui/icons';
import { formatScheduleDateTime } from '../utils/scheduleDate';

interface ScheduleStatusNoticeProps {
    value: string;
}

const ScheduleStatusNotice = ({ value }: ScheduleStatusNoticeProps) => {
    if (!value) return null;

    return (
        <div className="mb-4 rounded-xl border border-line bg-surface-subtle px-4 py-3 text-sm text-content-secondary">
            <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 shrink-0 text-content-hint" />
                <span className="font-medium text-content">예약 발행</span>
                <span className="min-w-0 truncate">{formatScheduleDateTime(value)}</span>
            </div>
        </div>
    );
};

export default ScheduleStatusNotice;
