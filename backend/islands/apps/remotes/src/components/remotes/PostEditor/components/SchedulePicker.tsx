import { useMemo, useState } from 'react';
import { Trans, useLingui } from '@lingui/react/macro';
import { Popover } from '@blex/ui/popover';
import { Calendar, Clock, X } from '@blex/ui/icons';
import { DayPicker } from 'react-day-picker';
import { enUS, ko } from 'react-day-picker/locale';
import { cx } from '~/lib/classnames';
import { normalizeLocale } from '~/i18n/locale';
import { formatDateTimeLocal, formatScheduleDateTime, parseDateTimeLocal } from '../utils/scheduleDate';

interface SchedulePickerProps {
    value: string;
    onChange: (value: string) => void;
    allowClear?: boolean;
}

const pad = (value: number) => value.toString().padStart(2, '0');

const startOfToday = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
};

const roundToNextHour = (date = new Date()) => {
    const next = new Date(date);
    next.setHours(next.getHours() + 1, 0, 0, 0);
    return next;
};

const getDateWithTime = (date: Date, source: Date | null) => {
    const next = new Date(date);
    const time = source || roundToNextHour();
    next.setHours(time.getHours(), time.getMinutes(), 0, 0);
    return next;
};

const parseBoundedNumber = (value: string, min: number, max: number) => {
    const parsed = Number.parseInt(value, 10);
    if (Number.isNaN(parsed)) return null;
    return Math.min(Math.max(parsed, min), max);
};

const dayPickerClassNames = {
    root: 'w-full',
    months: 'flex w-full',
    month: 'w-full',
    month_caption: 'relative flex h-11 items-center justify-center',
    caption_label: 'text-sm font-semibold text-content',
    nav: 'absolute right-0 top-0 flex items-center gap-1',
    button_previous: 'inline-flex h-11 w-11 items-center justify-center rounded-lg text-content-secondary hover:bg-surface-subtle hover:text-content active:scale-95',
    button_next: 'inline-flex h-11 w-11 items-center justify-center rounded-lg text-content-secondary hover:bg-surface-subtle hover:text-content active:scale-95',
    chevron: 'h-4 w-4',
    month_grid: 'mt-3 w-full border-collapse',
    weekdays: 'border-b border-line-light',
    weekday: 'h-8 text-center text-[11px] font-semibold text-content-hint',
    week: '',
    day: 'p-0 text-center align-middle',
    day_button: 'mx-auto my-0.5 flex h-11 w-11 items-center justify-center rounded-lg text-sm font-medium text-content-secondary transition-all hover:bg-surface-subtle hover:text-content active:scale-95 focus:outline-none focus:ring-2 focus:ring-line-strong/50',
    outside: '[&>button]:text-content-hint/40',
    today: '[&>button]:ring-1 [&>button]:ring-line-strong',
    selected: '[&>button]:bg-content [&>button]:text-surface [&>button]:hover:bg-content',
    disabled: '[&>button]:cursor-not-allowed [&>button]:text-content-hint/30 [&>button]:hover:bg-transparent'
};

const SchedulePicker = ({ value, onChange, allowClear = true }: SchedulePickerProps) => {
    const { i18n, t } = useLingui();
    const locale = normalizeLocale(i18n.locale);
    const [isOpen, setIsOpen] = useState(false);
    const selectedDate = useMemo(() => parseDateTimeLocal(value), [value]);
    const hour = selectedDate ? selectedDate.getHours() : roundToNextHour().getHours();
    const minute = selectedDate ? selectedDate.getMinutes() : 0;
    const quickOptions = [
        {
            label: t({
                id: 'editor.schedule.in_three_hours',
                message: 'In 3 hours'
            }),
            getDate: () => {
                const date = new Date();
                date.setHours(date.getHours() + 3, 0, 0, 0);
                return date;
            }
        },
        {
            label: t({
                id: 'editor.schedule.tomorrow_morning',
                message: 'Tomorrow at 9:00 AM'
            }),
            getDate: () => {
                const date = new Date();
                date.setDate(date.getDate() + 1);
                date.setHours(9, 0, 0, 0);
                return date;
            }
        },
        {
            label: t({
                id: 'editor.schedule.next_week_morning',
                message: 'Next week at 9:00 AM'
            }),
            getDate: () => {
                const date = new Date();
                date.setDate(date.getDate() + 7);
                date.setHours(9, 0, 0, 0);
                return date;
            }
        }
    ];

    const handleDaySelect = (date?: Date) => {
        if (!date) return;
        onChange(formatDateTimeLocal(getDateWithTime(date, selectedDate)));
    };

    const handleTimeChange = (nextHour: number, nextMinute: number) => {
        const base = selectedDate || roundToNextHour();
        const next = new Date(base);
        next.setHours(nextHour, nextMinute, 0, 0);
        onChange(formatDateTimeLocal(next));
    };

    return (
        <div className="space-y-3">
            <Popover.Root open={isOpen} onOpenChange={setIsOpen}>
                <div className="relative">
                    <Popover.Trigger asChild>
                        <button
                            type="button"
                            className={cx(
                                'flex min-h-12 w-full items-center justify-between rounded-lg border border-line bg-surface-elevated px-3 py-2 pr-12 text-left text-sm transition-colors',
                                'hover:border-line-strong hover:bg-surface-subtle focus:outline-none focus:ring-2 focus:ring-line/70'
                            )}>
                            <span className="flex min-w-0 items-center gap-2">
                                <Calendar className="h-4 w-4 shrink-0 text-content-hint" />
                                <span className={value ? 'text-content' : 'text-content-hint'}>
                                    {value
                                        ? formatScheduleDateTime(value, locale)
                                        : t({
                                            id: 'editor.schedule.select_time',
                                            message: 'Select a publish time'
                                        })}
                                </span>
                            </span>
                        </button>
                    </Popover.Trigger>
                    {allowClear && value && (
                        <button
                            type="button"
                            onClick={(event) => {
                                event.stopPropagation();
                                onChange('');
                            }}
                            className="absolute right-0 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-lg text-content-hint hover:bg-surface hover:text-content active:scale-95"
                            aria-label={t({
                                id: 'editor.schedule.clear',
                                message: 'Clear schedule'
                            })}>
                            <X className="h-4 w-4" />
                        </button>
                    )}
                </div>
                <Popover.Portal>
                    <Popover.Content
                        side="bottom"
                        align="start"
                        sideOffset={8}
                        className="z-[70] w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-line bg-surface-elevated p-4 shadow-2xl outline-none">
                        <DayPicker
                            mode="single"
                            locale={locale === 'ko' ? ko : enUS}
                            selected={selectedDate || undefined}
                            onSelect={handleDaySelect}
                            disabled={{ before: startOfToday() }}
                            weekStartsOn={1}
                            classNames={dayPickerClassNames}
                        />

                        <div className="mt-4 border-t border-line-light pt-4">
                            <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-content-secondary">
                                <Clock className="h-3.5 w-3.5" />
                                <Trans id="editor.schedule.time">Time</Trans>
                            </div>
                            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                                <input
                                    type="number"
                                    min={0}
                                    max={23}
                                    value={pad(hour)}
                                    onFocus={(event) => event.currentTarget.select()}
                                    onChange={(event) => {
                                        const nextHour = parseBoundedNumber(event.target.value, 0, 23);
                                        if (nextHour === null) return;
                                        handleTimeChange(nextHour, minute);
                                    }}
                                    className="h-11 rounded-lg border border-line bg-surface px-3 text-center text-sm font-medium text-content focus:border-line-strong focus:outline-none focus:ring-2 focus:ring-line/70"
                                    aria-label={t({
                                        id: 'editor.schedule.hour',
                                        message: 'Scheduled hour'
                                    })}
                                />
                                <span className="text-content-hint">:</span>
                                <input
                                    type="number"
                                    min={0}
                                    max={59}
                                    step={5}
                                    value={pad(minute)}
                                    onFocus={(event) => event.currentTarget.select()}
                                    onChange={(event) => {
                                        const nextMinute = parseBoundedNumber(event.target.value, 0, 59);
                                        if (nextMinute === null) return;
                                        handleTimeChange(hour, nextMinute);
                                    }}
                                    className="h-11 rounded-lg border border-line bg-surface px-3 text-center text-sm font-medium text-content focus:border-line-strong focus:outline-none focus:ring-2 focus:ring-line/70"
                                    aria-label={t({
                                        id: 'editor.schedule.minute',
                                        message: 'Scheduled minute'
                                    })}
                                />
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2">
                                {quickOptions.map((option) => (
                                    <button
                                        key={option.label}
                                        type="button"
                                        onClick={() => onChange(formatDateTimeLocal(option.getDate()))}
                                        className="min-h-11 rounded-lg border border-line bg-surface px-3 py-2 text-xs font-medium text-content-secondary hover:border-line-strong hover:bg-surface-subtle hover:text-content active:scale-95">
                                        {option.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </Popover.Content>
                </Popover.Portal>
            </Popover.Root>
        </div>
    );
};

export default SchedulePicker;
