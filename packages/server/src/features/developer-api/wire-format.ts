import type { FastifyInstance } from 'fastify';

const documentedName = /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/;

export function snakeToCamel(key: string): string {
  return key.replace(/_([a-z])/g, (_match, letter: string) => letter.toUpperCase());
}

export function camelToSnake(key: string): string {
  return key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

/** Fastify's query parser builds objects from a class whose prototype has no parent, so match that shape too. */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype: object | null = Object.getPrototypeOf(value);
  return prototype === null || Object.getPrototypeOf(prototype) === null;
}

/** Walks with a work list because a 1 MB request body can nest deeper than the call stack. */
function convertKeys(root: unknown, rename: (key: string) => string | null): unknown {
  const pending: Array<() => void> = [];
  const copy = (value: unknown): unknown => {
    if (Array.isArray(value)) {
      const items: unknown[] = new Array(value.length);
      pending.push(() =>
        value.forEach((item, index) => {
          items[index] = copy(item);
        }),
      );
      return items;
    }
    if (!isPlainObject(value)) return value;
    const entries: Record<string, unknown> = Object.create(null);
    pending.push(() => {
      for (const [key, item] of Object.entries(value)) {
        const name = rename(key);
        if (name !== null) entries[name] = copy(item);
      }
    });
    return entries;
  };
  const result = copy(root);
  for (let task = pending.pop(); task; task = pending.pop()) task();
  return result;
}

/**
 * The API has always ignored keys it does not document. Dropping non-snake keys keeps a caller's
 * `isHidden` from suddenly meaning `is_hidden` once handlers read camelCase.
 */
export function keysFromWire(value: unknown): unknown {
  return convertKeys(value, (key) => (documentedName.test(key) ? snakeToCamel(key) : null));
}

/** `dryRun` is the one undocumented spelling kept, because a caller who wrote it asked not to delete. */
function queryFromWire(query: unknown): unknown {
  const converted = keysFromWire(query);
  if (isPlainObject(query) && isPlainObject(converted)) converted.dryRunCamelCase = query.dryRun;
  return converted;
}

/** `error.fields` is keyed by the request field names callers sent, so it is written in wire format and left alone. */
export function keysToWire(payload: unknown): unknown {
  const converted = convertKeys(payload, camelToSnake);
  if (
    isPlainObject(payload) &&
    isPlainObject(payload.error) &&
    'fields' in payload.error &&
    isPlainObject(converted) &&
    isPlainObject(converted.error)
  ) {
    converted.error.fields = payload.error.fields;
  }
  return converted;
}

/** Fastify skips preSerialization for strings, buffers, and streams, so non-JSON replies never reach the converter. */
export function registerWireFormat(routes: FastifyInstance) {
  routes.addHook('preValidation', async (request) => {
    request.query = queryFromWire(request.query);
    request.body = keysFromWire(request.body);
  });
  routes.addHook('preSerialization', async (_request, _reply, payload) => keysToWire(payload));
}
