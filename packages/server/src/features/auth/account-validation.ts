import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import type { FastifyRequest } from 'fastify';

export const accountUsernamePattern = /^[a-z0-9]{4,15}$/;
export const accountEmailPattern = /^[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,64}$/i;

export function normalizeAccountEmail(email: string): string {
  const [local, domain] = email.split('@');
  return `${local}@${domain.toLowerCase()}`;
}

export function signupRegion(request: FastifyRequest, timeZone: string) {
  const configuredLanguage = request.cookies.django_language;
  const preferred = configuredLanguage || request.headers['accept-language']?.split(',')[0].split(/[;-]/)[0];
  const language = preferred === 'en' && process.env.ENABLE_ENGLISH_UI === 'TRUE' ? 'en' : 'ko';
  try {
    if (timeZone && timeZone.length <= 64 && timeZone !== 'Factory' && !/^[+-]/.test(timeZone)) {
      new Intl.DateTimeFormat('en', { timeZone });
      return { language, timeZone };
    }
  } catch {
    return { language, timeZone: '' };
  }
  return { language, timeZone: '' };
}

let commonPasswords: Set<string> | undefined;

function isCommon(password: string): boolean {
  // The same common-password denylist as 3.x keeps new credentials compatible.
  commonPasswords ??= new Set(gunzipSync(readFileSync(
    new URL('../../../../data/common-passwords.txt.gz', import.meta.url),
  )).toString('utf8').trim().split(/\r?\n/));
  return commonPasswords.has(password.toLowerCase().trim());
}

function similarity(left: string, right: string): number {
  const available = new Map<string, number>();
  for (const character of right) available.set(character, (available.get(character) ?? 0) + 1);
  let matches = 0;
  for (const character of left) {
    const count = available.get(character) ?? 0;
    if (!count) continue;
    matches += 1;
    available.set(character, count - 1);
  }
  return (2 * matches) / ([...left].length + [...right].length);
}

// The Korean validator wording from 3.x, in the order callers pass the account fields.
const personalFieldLabels = ['사용자 이름', '이름', '이메일 주소'];

export function describeInvalidPassword(password: string, personalFields: string[]): string | null {
  if ([...password].length < 8) return '비밀번호는 8자 이상이어야 합니다.';
  const lower = password.toLowerCase();
  for (const [index, field] of personalFields.entries()) {
    const parts = field.toLowerCase().split(/[^\p{L}\p{N}_]+/u);
    if ([...parts, field.toLowerCase()].some((part) => part && similarity(lower, part) >= 0.7)) {
      return `비밀번호가 ${personalFieldLabels[index]}와 너무 유사합니다.`;
    }
  }
  if (isCommon(password)) return '너무 흔히 사용되는 비밀번호입니다.';
  if (/^\p{N}+$/u.test(password)) return '비밀번호가 전부 숫자로 되어 있습니다.';
  return null;
}
