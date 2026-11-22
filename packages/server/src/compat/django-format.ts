type StoredDate = string | Date | null | undefined;

const displayTimeZone = () => process.env.TZ || 'Asia/Seoul';

function parseInstant(value: StoredDate): { date: Date; microseconds: string } | null {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.valueOf()) ? null : { date: value, microseconds: `${String(value.getUTCMilliseconds()).padStart(3, '0')}000` };
  }
  const normalized = value.trim().replace(' ', 'T');
  const fraction = /\.(\d+)/.exec(normalized)?.[1] ?? '';
  const zoned = /(?:Z|[+-]\d\d:?\d\d)$/i.test(normalized) ? normalized : `${normalized}Z`;
  const date = new Date(zoned.replace(/\.\d+/, (digits) => digits.slice(0, 4)));
  return Number.isNaN(date.valueOf()) ? null : { date, microseconds: fraction.padEnd(6, '0').slice(0, 6) };
}

function localParts(date: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: displayTimeZone(), hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(date);
  const field = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  return { year: field('year'), month: field('month'), day: field('day'), hour: field('hour'), minute: field('minute'), second: field('second') };
}

/** Rebuilds the naive UTC text 3.x stored, so a date read from a Prisma column keeps every existing output format. */
export function storedDateText(value: Date | number | bigint): string {
  const date = value instanceof Date ? value : new Date(Number(value));
  const milliseconds = date.getUTCMilliseconds();
  const seconds = date.toISOString().slice(0, 19).replace('T', ' ');
  return milliseconds === 0 ? seconds : `${seconds}.${String(milliseconds).padStart(3, '0')}000`;
}

/** Python `datetime.isoformat()` for a UTC value. */
export function djangoIso(value: StoredDate): string | null {
  const instant = parseInstant(value);
  if (!instant) return null;
  const fraction = instant.microseconds === '000000' ? '' : `.${instant.microseconds}`;
  return `${instant.date.toISOString().slice(0, 19)}${fraction}+00:00`;
}

/** DjangoJSONEncoder output for a UTC value. */
export function djangoJsonUtc(value: StoredDate): string | null {
  const instant = parseInstant(value);
  if (!instant) return null;
  const fraction = instant.microseconds === '000000' ? '' : `.${instant.microseconds.slice(0, 3)}`;
  return `${instant.date.toISOString().slice(0, 19)}${fraction}Z`;
}

/** DjangoJSONEncoder output for a value converted to the display time zone. */
export function djangoJsonLocal(value: StoredDate): string | null {
  const instant = parseInstant(value);
  if (!instant) return null;
  const local = localParts(instant.date);
  const asUtc = Date.UTC(Number(local.year), Number(local.month) - 1, Number(local.day), Number(local.hour), Number(local.minute), Number(local.second));
  const offset = Math.round((asUtc - Math.floor(instant.date.valueOf() / 1000) * 1000) / 60_000);
  const sign = offset < 0 ? '-' : '+';
  const hours = String(Math.floor(Math.abs(offset) / 60)).padStart(2, '0');
  const minutes = String(Math.abs(offset) % 60).padStart(2, '0');
  const fraction = instant.microseconds === '000000' ? '' : `.${instant.microseconds.slice(0, 3)}`;
  const zone = offset === 0 ? 'Z' : `${sign}${hours}:${minutes}`;
  return `${local.year}-${local.month}-${local.day}T${local.hour}:${local.minute}:${local.second}${fraction}${zone}`;
}

export function localDate(value: StoredDate): string {
  const instant = parseInstant(value);
  if (!instant) return '';
  const { year, month, day } = localParts(instant.date);
  return `${year}-${month}-${day}`;
}

export function localDateTimeText(value: StoredDate): string {
  const instant = parseInstant(value);
  if (!instant) return '';
  const { year, month, day, hour, minute } = localParts(instant.date);
  return `${year}-${month}-${day} ${hour}:${minute}`;
}

/** Django's Korean DATE_FORMAT, "Y년 n월 j일". */
export function koreanDate(value: StoredDate): string {
  const instant = parseInstant(value);
  if (!instant) return '';
  const { year, month, day } = localParts(instant.date);
  return `${year}년 ${Number(month)}월 ${Number(day)}일`;
}

/** Django's Korean DATETIME_FORMAT, "Y년 n월 j일 g:i A". */
export function koreanDateTime(value: StoredDate): string {
  const instant = parseInstant(value);
  if (!instant) return '';
  const { hour, minute } = localParts(instant.date);
  const hours = Number(hour);
  return `${koreanDate(value)} ${hours % 12 || 12}:${minute} ${hours < 12 ? '오전' : '오후'}`;
}

/** Follows the 3.x relative date: a calendar date after a year, otherwise the largest elapsed unit. */
export function timeSince(value: StoredDate, now = new Date()): string {
  const date = parseInstant(value)?.date;
  if (!date) return '';
  if (now.valueOf() - date.valueOf() > 365 * 24 * 60 * 60 * 1000) {
    const { year, month, day } = localParts(date);
    return `${year}년 ${Number(month)}월 ${Number(day)}일`;
  }
  const withinMonth = (moment: Date) => moment.valueOf() - Date.UTC(moment.getUTCFullYear(), moment.getUTCMonth(), 1);
  const months = (now.getUTCFullYear() - date.getUTCFullYear()) * 12 + now.getUTCMonth() - date.getUTCMonth()
    - (withinMonth(date) > withinMonth(now) ? 1 : 0);
  if (months >= 12) return `${Math.floor(months / 12)}년 전`;
  if (months > 0) return `${months}개월 전`;
  const minutes = Math.max(0, Math.floor((now.valueOf() - date.valueOf()) / 60_000));
  const units: Array<[number, string]> = [[7 * 24 * 60, '주'], [24 * 60, '일'], [60, '시간']];
  for (const [size, label] of units) {
    if (minutes >= size) return `${Math.floor(minutes / size)}${label} 전`;
  }
  return `${minutes}분 전`;
}
