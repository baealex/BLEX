export interface TimelapseBlock {
    /** Lowercase tag that renders the block: p, h2, li, pre, figure... */
    tag: string;
    /** Plain text for textual blocks; the full markup for media blocks, compared as a whole. */
    text: string;
    /** Markup that renders the block. For list items this is the item's inner HTML. */
    html: string;
    textual: boolean;
    listTag?: 'ul' | 'ol';
}

export interface ParsedFrame {
    title: string;
    blocks: TimelapseBlock[];
}

export interface TextOp {
    kind: 'equal' | 'insert' | 'delete';
    text: string;
}

export type BlockChange =
    | { kind: 'same'; block: TimelapseBlock }
    | { kind: 'edit'; block: TimelapseBlock; ops: TextOp[] }
    | { kind: 'insert'; block: TimelapseBlock }
    | { kind: 'delete'; block: TimelapseBlock };

export interface FrameDiff {
    title: TextOp[];
    blocks: BlockChange[];
}

export interface ChangeSummary {
    titleChanged: boolean;
    /** Headings first written in this save; headings that only moved are left out. */
    addedSections: string[];
    added: number;
    removed: number;
    rewritten: number;
    edited: boolean;
    insertedCharacters: number;
    deletedCharacters: number;
}

const TOKEN_PATTERN = /\s+|[\p{L}\p{N}_]+|[^\s\p{L}\p{N}_]/gu;
const HEADING_TAG = /^h[1-6]$/;
/** Paragraphs that share fewer words than this are shown as removed and rewritten. */
const MIN_PAIR_SIMILARITY = 0.3;
/** Above these sizes an exact LCS gets too slow for a smooth step, so the middle is replaced as a whole. */
const MAX_TOKEN_CELLS = 250_000;
const MAX_BLOCK_CELLS = 40_000;

export const tokenize = (text: string): string[] => text.match(TOKEN_PATTERN) ?? [];

export const countVisibleCharacters = (text: string) => Array.from(text.replace(/\s/g, '')).length;

const words = (text: string) => tokenize(text).filter((token) => token.trim());

const commonPrefixLength = <T>(a: T[], b: T[], isEqual: (x: T, y: T) => boolean) => {
    let length = 0;
    while (length < a.length && length < b.length && isEqual(a[length], b[length])) length++;
    return length;
};

const commonSuffixLength = <T>(a: T[], b: T[], skip: number, isEqual: (x: T, y: T) => boolean) => {
    let length = 0;
    while (
        length < a.length - skip
        && length < b.length - skip
        && isEqual(a[a.length - 1 - length], b[b.length - 1 - length])
    ) length++;
    return length;
};

const lcsTable = <T>(a: T[], b: T[], isEqual: (x: T, y: T) => boolean) => {
    const table = Array.from({ length: a.length + 1 }, () => new Int32Array(b.length + 1));
    for (let i = a.length - 1; i >= 0; i--) {
        for (let j = b.length - 1; j >= 0; j--) {
            table[i][j] = isEqual(a[i], b[j])
                ? table[i + 1][j + 1] + 1
                : Math.max(table[i + 1][j], table[i][j + 1]);
        }
    }
    return table;
};

const pushOp = (ops: TextOp[], kind: TextOp['kind'], text: string) => {
    if (!text) return;
    const last = ops[ops.length - 1];
    if (last && last.kind === kind) last.text += text;
    else ops.push({
        kind,
        text
    });
};

/**
 * Within one changed run, keep the characters both sides share at the edges
 * so "40분 동안" → "40분쯤" deletes " 동안" and inserts "쯤" instead of whole words.
 */
const pushChangedRun = (ops: TextOp[], deleted: string, inserted: string) => {
    const before = Array.from(deleted);
    const after = Array.from(inserted);
    const isSame = (x: string, y: string) => x === y;
    const prefix = commonPrefixLength(before, after, isSame);
    const suffix = commonSuffixLength(before, after, prefix, isSame);
    pushOp(ops, 'equal', before.slice(0, prefix).join(''));
    pushOp(ops, 'delete', before.slice(prefix, before.length - suffix).join(''));
    pushOp(ops, 'insert', after.slice(prefix, after.length - suffix).join(''));
    pushOp(ops, 'equal', before.slice(before.length - suffix).join(''));
};

export const diffText = (beforeText: string, afterText: string): TextOp[] => {
    if (beforeText === afterText) return beforeText ? [{
        kind: 'equal',
        text: beforeText
    }] : [];

    const before = tokenize(beforeText);
    const after = tokenize(afterText);
    const isSame = (x: string, y: string) => x === y;
    const prefix = commonPrefixLength(before, after, isSame);
    const suffix = commonSuffixLength(before, after, prefix, isSame);
    const middleBefore = before.slice(prefix, before.length - suffix);
    const middleAfter = after.slice(prefix, after.length - suffix);

    const raw: TextOp[] = [];
    if (prefix) raw.push({
        kind: 'equal',
        text: before.slice(0, prefix).join('')
    });
    if (middleBefore.length * middleAfter.length > MAX_TOKEN_CELLS) {
        raw.push({
            kind: 'delete',
            text: middleBefore.join('')
        });
        raw.push({
            kind: 'insert',
            text: middleAfter.join('')
        });
    } else {
        const table = lcsTable(middleBefore, middleAfter, isSame);
        let i = 0;
        let j = 0;
        while (i < middleBefore.length && j < middleAfter.length) {
            if (middleBefore[i] === middleAfter[j]) {
                raw.push({
                    kind: 'equal',
                    text: middleBefore[i]
                });
                i++;
                j++;
            } else if (table[i + 1][j] >= table[i][j + 1]) {
                raw.push({
                    kind: 'delete',
                    text: middleBefore[i++]
                });
            } else {
                raw.push({
                    kind: 'insert',
                    text: middleAfter[j++]
                });
            }
        }
        while (i < middleBefore.length) raw.push({
            kind: 'delete',
            text: middleBefore[i++]
        });
        while (j < middleAfter.length) raw.push({
            kind: 'insert',
            text: middleAfter[j++]
        });
    }
    if (suffix) raw.push({
        kind: 'equal',
        text: before.slice(before.length - suffix).join('')
    });

    // A lone space between two changed words belongs to the change, not to the unchanged text.
    const folded: TextOp[] = [];
    raw.forEach((op, index) => {
        const isBetweenChanges = index > 0
            && index < raw.length - 1
            && raw[index - 1].kind !== 'equal'
            && raw[index + 1].kind !== 'equal';
        if (op.kind === 'equal' && !op.text.trim() && isBetweenChanges) {
            folded.push({
                kind: 'delete',
                text: op.text
            }, {
                kind: 'insert',
                text: op.text
            });
        } else {
            folded.push(op);
        }
    });

    const ops: TextOp[] = [];
    let deleted = '';
    let inserted = '';
    const flush = () => {
        if (deleted || inserted) pushChangedRun(ops, deleted, inserted);
        deleted = '';
        inserted = '';
    };
    for (const op of folded) {
        if (op.kind === 'equal') {
            flush();
            pushOp(ops, 'equal', op.text);
        } else if (op.kind === 'delete') {
            deleted += op.text;
        } else {
            inserted += op.text;
        }
    }
    flush();
    return ops;
};

const isSameBlock = (a: TimelapseBlock, b: TimelapseBlock) => (
    a.tag === b.tag && a.listTag === b.listTag && a.text === b.text
);

/** Shared-word ratio; cheap enough to compare every pair of paragraphs in the changed middle. */
export const blockSimilarity = (a: TimelapseBlock, b: TimelapseBlock) => {
    if (a.tag !== b.tag || a.textual !== b.textual) return 0;
    if (a.text === b.text) return 1;
    if (!a.textual) return 0;
    const aWords = words(a.text);
    const bWords = words(b.text);
    if (!aWords.length || !bWords.length) return 0;
    const counts = new Map<string, number>();
    aWords.forEach((word) => counts.set(word, (counts.get(word) ?? 0) + 1));
    let shared = 0;
    bWords.forEach((word) => {
        const count = counts.get(word) ?? 0;
        if (count > 0) {
            shared++;
            counts.set(word, count - 1);
        }
    });
    return (2 * shared) / (aWords.length + bWords.length);
};

const toChange = (before: TimelapseBlock, after: TimelapseBlock): BlockChange => {
    if (before.text === after.text) return {
        kind: 'same',
        block: after
    };
    return {
        kind: 'edit',
        block: after,
        ops: diffText(before.text, after.text)
    };
};

export const alignBlocks = (before: TimelapseBlock[], after: TimelapseBlock[]): BlockChange[] => {
    const prefix = commonPrefixLength(before, after, isSameBlock);
    const suffix = commonSuffixLength(before, after, prefix, isSameBlock);
    const middleBefore = before.slice(prefix, before.length - suffix);
    const middleAfter = after.slice(prefix, after.length - suffix);
    const changes: BlockChange[] = after.slice(0, prefix).map((block) => ({
        kind: 'same',
        block
    }));

    const usePairing = middleBefore.length * middleAfter.length <= MAX_BLOCK_CELLS;
    const similarity = middleBefore.map((a) => middleAfter.map((b) => (
        usePairing ? blockSimilarity(a, b) : Number(isSameBlock(a, b))
    )));
    const score = Array.from({ length: middleBefore.length + 1 }, () => new Float64Array(middleAfter.length + 1));
    for (let i = middleBefore.length - 1; i >= 0; i--) {
        for (let j = middleAfter.length - 1; j >= 0; j--) {
            let best = Math.max(score[i + 1][j], score[i][j + 1]);
            if (similarity[i][j] >= MIN_PAIR_SIMILARITY) {
                best = Math.max(best, similarity[i][j] + score[i + 1][j + 1]);
            }
            score[i][j] = best;
        }
    }

    let i = 0;
    let j = 0;
    while (i < middleBefore.length && j < middleAfter.length) {
        const pairScore = similarity[i][j] + score[i + 1][j + 1];
        if (similarity[i][j] >= MIN_PAIR_SIMILARITY && Math.abs(score[i][j] - pairScore) < 1e-9) {
            changes.push(toChange(middleBefore[i++], middleAfter[j++]));
        } else if (score[i + 1][j] >= score[i][j + 1]) {
            changes.push({
                kind: 'delete',
                block: middleBefore[i++]
            });
        } else {
            changes.push({
                kind: 'insert',
                block: middleAfter[j++]
            });
        }
    }
    while (i < middleBefore.length) changes.push({
        kind: 'delete',
        block: middleBefore[i++]
    });
    while (j < middleAfter.length) changes.push({
        kind: 'insert',
        block: middleAfter[j++]
    });

    after.slice(after.length - suffix).forEach((block) => changes.push({
        kind: 'same',
        block
    }));
    return changes;
};

export const diffFrames = (before: ParsedFrame, after: ParsedFrame): FrameDiff => ({
    title: diffText(before.title, after.title),
    blocks: alignBlocks(before.blocks, after.blocks)
});

export const measureFrame = (frame: ParsedFrame) => frame.blocks.reduce(
    (total, block) => total + (block.textual ? countVisibleCharacters(block.text) : 0),
    countVisibleCharacters(frame.title)
);

const blockCharacters = (block: TimelapseBlock) => (block.textual ? countVisibleCharacters(block.text) : 0);

const countOps = (ops: TextOp[], kind: TextOp['kind']) => ops
    .filter((op) => op.kind === kind)
    .reduce((total, op) => total + countVisibleCharacters(op.text), 0);

const blockKey = (block: TimelapseBlock) => `${block.listTag ?? ''}|${block.tag}|${block.text}`;

const isBlank = (block: TimelapseBlock) => block.textual && !block.text.trim();

const countKeys = (changes: BlockChange[], kind: 'insert' | 'delete') => {
    const counts = new Map<string, number>();
    changes
        .filter((change) => change.kind === kind && !isBlank(change.block))
        .forEach((change) => counts.set(blockKey(change.block), (counts.get(blockKey(change.block)) ?? 0) + 1));
    return counts;
};

/** Takes one unit from the budget for this block; true means the block only moved. */
const takeMoved = (budget: Map<string, number>, block: TimelapseBlock) => {
    const key = blockKey(block);
    const remaining = budget.get(key) ?? 0;
    if (remaining <= 0) return false;
    budget.set(key, remaining - 1);
    return true;
};

export const summarizeDiff = (diff: FrameDiff): ChangeSummary => {
    // Unchanged blocks removed in one place and added in another were moved, not written or deleted.
    const insertedKeys = countKeys(diff.blocks, 'insert');
    const deletedKeys = countKeys(diff.blocks, 'delete');
    const movedInsertBudget = new Map<string, number>();
    insertedKeys.forEach((count, key) => movedInsertBudget.set(key, Math.min(count, deletedKeys.get(key) ?? 0)));
    const movedDeleteBudget = new Map(movedInsertBudget);

    const insertedByTag = new Map<string, number>();
    const deletedByTag = new Map<string, number>();
    const addedSections: string[] = [];
    let insertedCharacters = countOps(diff.title, 'insert');
    let deletedCharacters = countOps(diff.title, 'delete');
    let edited = false;

    for (const change of diff.blocks) {
        if (change.kind === 'edit') {
            edited = true;
            insertedCharacters += countOps(change.ops, 'insert');
            deletedCharacters += countOps(change.ops, 'delete');
        } else if (change.kind === 'insert') {
            if (isBlank(change.block) || takeMoved(movedInsertBudget, change.block)) continue;
            insertedCharacters += blockCharacters(change.block);
            if (HEADING_TAG.test(change.block.tag)) {
                addedSections.push(change.block.text.trim());
            } else {
                insertedByTag.set(change.block.tag, (insertedByTag.get(change.block.tag) ?? 0) + 1);
            }
        } else if (change.kind === 'delete') {
            if (isBlank(change.block) || takeMoved(movedDeleteBudget, change.block)) continue;
            deletedCharacters += blockCharacters(change.block);
            deletedByTag.set(change.block.tag, (deletedByTag.get(change.block.tag) ?? 0) + 1);
        }
    }

    // A paragraph removed and another of the same kind added in one save reads as a rewrite.
    let rewritten = 0;
    for (const [tag, count] of insertedByTag) {
        const pairs = Math.min(count, deletedByTag.get(tag) ?? 0);
        rewritten += pairs;
        insertedByTag.set(tag, count - pairs);
        deletedByTag.set(tag, (deletedByTag.get(tag) ?? 0) - pairs);
    }
    const sum = (counts: Map<string, number>) => [...counts.values()].reduce((total, count) => total + count, 0);

    return {
        titleChanged: diff.title.some((op) => op.kind !== 'equal'),
        addedSections,
        added: sum(insertedByTag),
        removed: sum(deletedByTag),
        rewritten,
        edited,
        insertedCharacters,
        deletedCharacters
    };
};
