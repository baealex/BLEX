export function done<T = object>(body: T = {} as T) {
  return { status: 'DONE', body };
}

export function failure(code: string, errorMessage = '', extra: Record<string, unknown> = {}) {
  return { status: 'ERROR', errorCode: `error:${code}`, errorMessage, ...extra };
}

export function messageFailure(code: string, errorMessage = '', messageKey?: string, messageParams: object = {}) {
  return failure(code, errorMessage, messageKey ? { messageKey, messageParams } : {});
}
