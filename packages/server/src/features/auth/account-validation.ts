import { systemMessage } from '../../platform/messages.js';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import type { FastifyRequest } from 'fastify';
import { supportedUiLocale } from '../../platform/locale.js';

export const accountUsernamePattern = /^[a-z0-9]{4,15}$/;
export const accountEmailPattern = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,64}$/i;

export function normalizeAccountEmail(email: string): string {
  const [local, domain] = email.split('@');
  return `${local}@${domain.toLowerCase()}`;
}

export function signupRegion(request: FastifyRequest, timeZone: string) {
  const language = supportedUiLocale(request.cookies.django_language) ?? '';
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
  commonPasswords ??= new Set(
    gunzipSync(readFileSync(new URL('../../../../data/common-passwords.txt.gz', import.meta.url)))
      .toString('utf8')
      .trim()
      .split(/\r?\n/),
  );
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

// Labels follow the order callers pass the account fields.
const personalFieldLabels = () => [systemMessage('Username'), systemMessage('Name'), systemMessage('Email address')];

export function describeInvalidPassword(password: string, personalFields: string[]): string | null {
  if ([...password].length < 8) return systemMessage('Passwords must be at least 8 characters long.');
  const lower = password.toLowerCase();
  for (const [index, field] of personalFields.entries()) {
    const parts = field.toLowerCase().split(/[^\p{L}\p{N}_]+/u);
    if ([...parts, field.toLowerCase()].some((part) => part && similarity(lower, part) >= 0.7)) {
      return systemMessage('The password is too similar to your {value0}.', { value0: personalFieldLabels()[index] });
    }
  }
  if (isCommon(password)) return systemMessage('This password is too common.');
  if (/^\p{N}+$/u.test(password)) return systemMessage('The password cannot contain only numbers.');
  return null;
}
