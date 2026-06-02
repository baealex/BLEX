const pad = (value: number) => value.toString().padStart(2, '0');

export const formatDateTimeLocal = (date: Date) => {
    return [
        date.getFullYear(),
        pad(date.getMonth() + 1),
        pad(date.getDate())
    ].join('-') + `T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

export const parseDateTimeLocal = (value: string) => {
    if (!value) return null;

    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
};

export const toDateTimeLocalValue = (value?: string | null) => {
    if (!value) return '';

    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : formatDateTimeLocal(date);
};

export const toReservedDateValue = (value?: string) => {
    const date = parseDateTimeLocal(value || '');
    return date ? date.toISOString() : value || '';
};

export const formatScheduleDateTime = (value: string) => {
    const date = parseDateTimeLocal(value);
    if (!date) return value;

    return date.toLocaleString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
};

export const isFutureDateTimeLocal = (value?: string) => {
    const date = parseDateTimeLocal(value || '');
    return Boolean(date && date.getTime() > Date.now());
};
