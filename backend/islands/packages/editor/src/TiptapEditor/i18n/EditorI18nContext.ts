import { createContext, useContext } from 'react';
import {
    formatEditorMessage,
    resolveEditorMessages
} from './messages';
import type {
    EditorMessageKey,
    EditorMessages,
    EditorMessageValues
} from './messages';

export interface EditorI18nValue {
    messages: EditorMessages;
    t: (key: EditorMessageKey, values?: EditorMessageValues) => string;
}

const defaultMessages = resolveEditorMessages('en');

export const EditorI18nContext = createContext<EditorI18nValue>({
    messages: defaultMessages,
    t: (key, values) => formatEditorMessage(defaultMessages[key], values)
});

export const useEditorI18n = () => useContext(EditorI18nContext);
