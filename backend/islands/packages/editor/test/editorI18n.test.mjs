import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    enEditorMessages,
    formatEditorMessage,
    loadEditorMessages,
    normalizeEditorLocale,
    resolveEditorMessages
} from '../src/TiptapEditor/i18n/messages.ts';
import { koEditorMessages } from '../src/TiptapEditor/i18n/locales/ko.ts';

describe('editor message catalogs', () => {
    it('keeps every built-in locale structurally complete', () => {
        assert.deepEqual(
            Object.keys(koEditorMessages).sort(),
            Object.keys(enEditorMessages).sort()
        );
    });

    it('loads regional locale tags and falls back to English', async () => {
        assert.equal(normalizeEditorLocale('ko-KR'), 'ko');
        await loadEditorMessages('ko-KR');
        assert.equal(resolveEditorMessages('ko-KR')['code.copy'], '코드 복사');
        assert.equal(resolveEditorMessages('fr-FR')['code.copy'], 'Copy code');
    });

    it('supports external locale overrides without losing fallback copy', () => {
        const messages = resolveEditorMessages('fr', { 'code.copy': 'Copier le code' });

        assert.equal(messages['code.copy'], 'Copier le code');
        assert.equal(messages['youtube.cancel'], 'Cancel');
    });

    it('interpolates dynamic values while preserving unknown placeholders', () => {
        assert.equal(
            formatEditorMessage('Uploading {count} files to {target}.', { count: 2 }),
            'Uploading 2 files to {target}.'
        );
    });
});
