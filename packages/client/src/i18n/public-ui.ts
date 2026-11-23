import { i18n } from '@lingui/core';

const translate = i18n._.bind(i18n);

/** Translate product copy only. Authored content is never passed through this helper. */
export function ui(message: string, values: Record<string, unknown> = {}, id = `public.${message}`): string {
    return translate(id, values, { message });
}
