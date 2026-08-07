import { enEditorMessages } from './locales/en.ts';

export type EditorMessageKey = keyof typeof enEditorMessages;
export type EditorMessages = Record<EditorMessageKey, string>;
export type EditorMessageOverrides = Partial<EditorMessages>;
export type EditorMessageValues = Record<string, string | number>;

const loadKoreanMessages = () => import('./locales/ko.ts')
    .then(({ koEditorMessages }) => koEditorMessages);
const builtinMessageLoaders: Record<string, () => Promise<EditorMessages>> = { ko: loadKoreanMessages };
const loadedBuiltinMessages = new Map<string, EditorMessages>([
    ['en', enEditorMessages]
]);
const pendingBuiltinMessages = new Map<string, Promise<EditorMessages>>();

export const normalizeEditorLocale = (locale: string | null | undefined) => (
    locale?.trim().toLowerCase().split(/[-_]/)[0] || 'en'
);

export const getLoadedEditorMessages = (
    locale: string | null | undefined
): EditorMessages | undefined => {
    const normalizedLocale = normalizeEditorLocale(locale);

    if (!builtinMessageLoaders[normalizedLocale]) {
        return enEditorMessages;
    }

    return loadedBuiltinMessages.get(normalizedLocale);
};

export const loadEditorMessages = (
    locale: string | null | undefined
): Promise<EditorMessages> => {
    const normalizedLocale = normalizeEditorLocale(locale);
    const loadedMessages = getLoadedEditorMessages(normalizedLocale);

    if (loadedMessages) {
        return Promise.resolve(loadedMessages);
    }

    const pendingMessages = pendingBuiltinMessages.get(normalizedLocale);
    if (pendingMessages) {
        return pendingMessages;
    }

    const loader = builtinMessageLoaders[normalizedLocale];
    const messagePromise = loader()
        .then((messages) => {
            loadedBuiltinMessages.set(normalizedLocale, messages);
            return messages;
        })
        .catch(() => enEditorMessages)
        .finally(() => {
            pendingBuiltinMessages.delete(normalizedLocale);
        });

    pendingBuiltinMessages.set(normalizedLocale, messagePromise);
    return messagePromise;
};

export const resolveEditorMessages = (
    locale: string | null | undefined,
    overrides: EditorMessageOverrides = {},
    builtinMessages = getLoadedEditorMessages(locale) ?? enEditorMessages
): EditorMessages => ({
    ...builtinMessages,
    ...overrides
});

export const formatEditorMessage = (
    message: string,
    values: EditorMessageValues = {}
) => message.replace(/\{(\w+)\}/g, (placeholder, key: string) => (
    Object.prototype.hasOwnProperty.call(values, key)
        ? String(values[key])
        : placeholder
));

export { enEditorMessages };
