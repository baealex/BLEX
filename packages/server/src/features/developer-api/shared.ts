import type { FastifyReply } from 'fastify';

export const API_PREFIX = '/api/developer/v1';

export interface QueryValue {
  [key: string]: string | string[] | undefined;
}

export interface DeveloperApiError {
  code: string;
  message: string;
  statusCode: number;
  fields?: object | null;
}

export function errorReply(reply: FastifyReply, error: DeveloperApiError) {
  return reply.code(error.statusCode).send({
    error: { code: error.code, message: error.message, fields: error.fields ?? null },
  });
}

export function readScalar(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value.at(-1);
  return value;
}

export function toIsoDateTime(value: string | Date | null): string | null {
  if (value === null) return null;
  const raw = value instanceof Date ? value.toISOString() : value;
  const match = raw.replace('T', ' ').match(/^(.+\d{2}:\d{2}:\d{2})(?:\.(\d+))?(Z|[+-]\d{2}:\d{2})?$/);
  if (!match) return raw;

  const fraction = match[2];
  const hasMicroseconds = fraction !== undefined && /[1-9]/.test(fraction);
  const normalizedFraction = hasMicroseconds
    ? `.${fraction.slice(0, 6).padEnd(6, '0')}`
    : '';
  const offset = match[3] === 'Z' ? '+00:00' : (match[3] ?? '+00:00');
  return `${match[1].replace(' ', 'T')}${normalizedFraction}${offset}`;
}

/** Dates are stored in milliseconds, so a version a client saved from 3.x may carry three more digits. */
export function sameVersion(expected: string, actual: Date): boolean {
  const milliseconds = expected.replace(/(\.\d{3})\d{3}(?=Z|[+-]\d{2}:\d{2}$|$)/, '$1000');
  return toIsoDateTime(milliseconds) === toIsoDateTime(actual);
}

export function formatError(code: string, message: string, statusCode: number): DeveloperApiError {
  return { code, message, statusCode };
}

export function parseIntegerQuery(value: string | undefined, fallback: number): number | null {
  if (value === undefined) return fallback;
  if (!/^[+-]?\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

export function parsePostId(value: string): number | null {
  if (!/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

const dryRunEnabled = /^(true|on|yes|1|y|t)$/i;
const dryRunDisabled = /^(false|off|no|0|n|f)$/i;

/** Any value asking for a dry run wins, and a value that cannot be read stops the request before it can delete. */
export function parseDryRun(query: QueryValue): { dryRun: boolean; invalid?: { field: string; value: string } } {
  let dryRun = false;
  for (const [field, sent] of [['dry_run', query.dryRun], ['dryRun', query.dryRunCamelCase]] as const) {
    for (const value of [sent ?? []].flat()) {
      if (dryRunEnabled.test(value)) dryRun = true;
      else if (!dryRunDisabled.test(value)) return { dryRun: true, invalid: { field, value } };
    }
  }
  return { dryRun };
}

export function parseValidationError(reply: FastifyReply, field: string, value: string) {
  return reply.code(422).send({
    error: {
      code: 'request.invalid_payload',
      message: 'The request payload could not be validated.',
      fields: {
        errors: [{
          type: 'int_parsing',
          loc: ['query', field],
          msg: `Input should be a valid integer, unable to parse string as an integer: '${value}'`,
          input: value,
        }],
      },
    },
  });
}

export type Editor = { id: number; username: string };

interface DeveloperPostMutations {
  create: (editor: Editor, input: Record<string, unknown>, asDraft: boolean) => Promise<{ id: number }>;
  update: (editor: Editor, id: number, input: Record<string, unknown>, expectedStoredUpdate?: string) => Promise<{ id: number } | null>;
  publish: (editor: Editor, id: number, input: Record<string, unknown>, expectedStoredUpdate: string) => Promise<{ id: number } | null>;
  trash: (editor: Editor, id: number) => Promise<string | null>;
  error: (failure: unknown) => DeveloperApiError | null;
}

export interface DeveloperApiOptions {
  writable?: boolean;
  mediaRoot?: string;
  mutations?: DeveloperPostMutations;
}
