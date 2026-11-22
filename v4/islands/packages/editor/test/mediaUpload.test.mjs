import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { classifyTextMediaDrop } from '../src/TiptapEditor/config/mediaUpload.ts';

const createDataTransfer = (data = {}, types = Object.keys(data)) => ({
    types,
    getData: format => data[format] ?? ''
});

describe('classifyTextMediaDrop', () => {
    test('classifies remote media HTML and URLs as external media', () => {
        const imageHtml = '<img src="https://example.com/image.png" alt="Remote">';
        assert.equal(classifyTextMediaDrop(
            createDataTransfer({ 'text/html': imageHtml })
        ), 'external-media');
        assert.equal(classifyTextMediaDrop(
            createDataTransfer({ 'text/uri-list': 'https://example.com/video.mp4?download=1' })
        ), 'external-media');
    });

    test('gives ProseMirror slices precedence over embedded media', () => {
        const sliceHtml = '<div data-pm-slice="0 0 []"><img src="https://example.com/internal.png"></div>';
        assert.equal(classifyTextMediaDrop(
            createDataTransfer({ 'text/html': sliceHtml })
        ), 'prosemirror');
        assert.equal(classifyTextMediaDrop(createDataTransfer(
            { 'text/html': '<img src="https://example.com/internal.png">' },
            ['application/x-prosemirror-slice', 'text/html']
        )), 'prosemirror');
    });

    test('ignores unrelated text drops', () => {
        assert.equal(classifyTextMediaDrop(
            createDataTransfer({ 'text/plain': 'ordinary text' })
        ), 'none');
    });
});
