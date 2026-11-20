import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
    alignBlocks,
    diffFrames,
    diffText,
    measureFrame,
    summarizeDiff
} from '../src/components/remotes/PostTimelapse/timelapseDiff.ts';

const p = (text) => ({
    tag: 'p',
    text,
    html: `<p>${text}</p>`,
    textual: true
});
const h2 = (text) => ({
    tag: 'h2',
    text,
    html: `<h2>${text}</h2>`,
    textual: true
});
const li = (text) => ({
    tag: 'li',
    text,
    html: text,
    textual: true,
    listTag: 'ul'
});
const image = (src) => ({
    tag: 'figure',
    text: `<figure><img src="${src}"></figure>`,
    html: `<figure><img src="${src}"></figure>`,
    textual: false
});

const applyOps = (ops, side) => ops
    .filter((op) => op.kind === 'equal' || op.kind === side)
    .map((op) => op.text)
    .join('');

describe('diffText', () => {
    test('reconstructs both versions from the operations', () => {
        const before = '클라우드 서버를 정리하고 블로그를 NAS로 옮겼다.';
        const after = '3년 동안 월 2만 원씩 내던 클라우드 서버를 정리하고, 블로그를 집에 있는 NAS로 옮겼다.';
        const ops = diffText(before, after);

        assert.equal(applyOps(ops, 'delete'), before);
        assert.equal(applyOps(ops, 'insert'), after);
        assert.deepEqual(ops.filter((op) => op.kind === 'delete'), []);
    });

    test('marks only the characters that changed inside a word', () => {
        assert.deepEqual(diffText('블로그는 40분 동안 꺼져 있었다.', '블로그는 40분쯤 꺼져 있었다.'), [
            {
                kind: 'equal',
                text: '블로그는 40분'
            },
            {
                kind: 'delete',
                text: ' 동안'
            },
            {
                kind: 'insert',
                text: '쯤'
            },
            {
                kind: 'equal',
                text: ' 꺼져 있었다.'
            }
        ]);
    });

    test('treats punctuation as its own token', () => {
        assert.deepEqual(diffText('정리하고 블로그를', '정리하고, 블로그를'), [
            {
                kind: 'equal',
                text: '정리하고'
            },
            {
                kind: 'insert',
                text: ','
            },
            {
                kind: 'equal',
                text: ' 블로그를'
            }
        ]);
    });
});

describe('alignBlocks', () => {
    test('pairs edited paragraphs and keeps unrelated ones as delete and insert', () => {
        const changes = alignBlocks(
            [p('첫 문단입니다.'), p('업로드가 자꾸 실패했다.'), p('메모: 나중에 쓰기')],
            [p('첫 문단입니다. 조금 더 썼다.'), p('가장 오래 붙잡은 건 크기 제한이었다.'), p('메모: 나중에 쓰기')]
        );

        assert.deepEqual(changes.map((change) => change.kind), ['edit', 'delete', 'insert', 'same']);
    });

    test('replaces changed media as a whole', () => {
        const changes = alignBlocks([image('/a.png')], [image('/b.png')]);

        assert.deepEqual(changes.map((change) => change.kind), ['delete', 'insert']);
    });
});

describe('summarizeDiff', () => {
    test('names a new section and counts the written characters', () => {
        const before = {
            title: '초안',
            blocks: [p('시작')]
        };
        const after = {
            title: '초안',
            blocks: [p('시작'), h2('한 달 써 보니'), p('아무도 몰랐다.')]
        };
        const summary = summarizeDiff(diffFrames(before, after));

        assert.equal(summary.addedSection, '한 달 써 보니');
        assert.equal(summary.added, 1);
        assert.equal(summary.insertedCharacters, measureFrame(after) - measureFrame(before));
        assert.equal(summary.titleChanged, false);
    });

    test('reads a removed and an added paragraph of the same kind as a rewrite', () => {
        const before = {
            title: '제목',
            blocks: [li('서버비'), p('업로드가 자꾸 실패했다.'), p('메모')]
        };
        const after = {
            title: '새 제목',
            blocks: [li('서버비'), p('가장 오래 붙잡은 건 크기 제한이었다.')]
        };
        const summary = summarizeDiff(diffFrames(before, after));

        assert.equal(summary.titleChanged, true);
        assert.equal(summary.rewritten, 1);
        assert.equal(summary.removed, 1);
        assert.equal(summary.added, 0);
    });
});
