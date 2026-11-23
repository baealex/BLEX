import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { EditorI18nContext } from './EditorI18nContext';
import type { EditorI18nValue } from './EditorI18nContext';
import {
    formatEditorMessage,
    getLoadedEditorMessages,
    loadEditorMessages,
    normalizeEditorLocale,
    resolveEditorMessages
} from './messages';
import type {
    EditorMessageOverrides,
    EditorMessages
} from './messages';

interface EditorI18nProviderProps {
    children: ReactNode;
    locale?: string;
    messages?: EditorMessageOverrides;
}

export const EditorI18nProvider = ({
    children,
    locale,
    messages: messageOverrides
}: EditorI18nProviderProps) => {
    const normalizedLocale = normalizeEditorLocale(locale);
    const [loadedCatalog, setLoadedCatalog] = useState<{
        locale: string;
        messages: EditorMessages;
    } | null>(() => {
        const messages = getLoadedEditorMessages(normalizedLocale);
        return messages
            ? {
                locale: normalizedLocale,
                messages
            }
            : null;
    });
    const builtinMessages = loadedCatalog?.locale === normalizedLocale
        ? loadedCatalog.messages
        : getLoadedEditorMessages(normalizedLocale);

    useEffect(() => {
        if (builtinMessages) {
            return;
        }

        let isCurrent = true;
        void loadEditorMessages(normalizedLocale).then((messages) => {
            if (isCurrent) {
                setLoadedCatalog({
                    locale: normalizedLocale,
                    messages
                });
            }
        });

        return () => {
            isCurrent = false;
        };
    }, [builtinMessages, normalizedLocale]);

    const value = useMemo<EditorI18nValue>(() => {
        const messages = resolveEditorMessages(
            normalizedLocale,
            messageOverrides,
            builtinMessages
        );
        return {
            messages,
            t: (key, values) => formatEditorMessage(messages[key], values)
        };
    }, [builtinMessages, messageOverrides, normalizedLocale]);

    if (!builtinMessages) {
        return null;
    }

    return (
        <EditorI18nContext.Provider value={value}>
            {children}
        </EditorI18nContext.Provider>
    );
};
