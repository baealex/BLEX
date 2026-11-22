import type {
    BlockChange,
    FrameDiff,
    ParsedFrame,
    TextOp,
    TimelapseBlock
} from './timelapseDiff';

/**
 * The stage is rendered imperatively: React owns only the empty title and
 * content elements, so a step can type hundreds of characters per second
 * without re-rendering the whole post.
 */
export interface TimelapseStage {
    title: HTMLElement;
    content: HTMLElement;
    scroller: HTMLElement;
}

export interface StepOptions {
    stage: TimelapseStage;
    diff: FrameDiff;
    signal: AbortSignal;
    getSpeed: () => number;
    reducedMotion: boolean;
}

const TEXT_BLOCK_TAGS = new Set(['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'pre']);
const MEDIA_SELECTOR = 'img, picture, video, audio, iframe, table, svg, canvas, figure, hr';

/** Styles live in postTimelapse.css, which loads with this screen instead of the shared stylesheet. */
const MARK_CLASS = {
    insert: 'post-timelapse-insert',
    delete: 'post-timelapse-delete',
    insertedMedia: 'post-timelapse-inserted-media',
    deletedMedia: 'post-timelapse-deleted-media',
    caret: 'post-timelapse-caret'
};

const TIMING = {
    lookBeforeChange: 650,
    holdDeletion: 750,
    collapseDeletion: 420,
    msPerCharacter: 30,
    minTyping: 500,
    maxTyping: 2800,
    holdAfterTyping: 450,
    settle: 500,
    reducedMotionStep: 1800,
    cameraCooldown: 500
};
/** Media has no characters to type; give it a short beat in the typing order. */
const MEDIA_TYPING_UNITS = 12;
/** Space at the bottom of the viewport covered by the playback bar. */
const BAR_CLEARANCE = 240;
const HEADER_CLEARANCE = 96;

/** Resolves true after `ms`, or false as soon as the signal aborts. */
export const wait = (ms: number, signal: AbortSignal) => new Promise<boolean>((resolve) => {
    if (signal.aborted) {
        resolve(false);
        return;
    }
    const onAbort = () => {
        clearTimeout(timer);
        resolve(false);
    };
    const timer = setTimeout(() => {
        signal.removeEventListener('abort', onAbort);
        resolve(true);
    }, ms);
    signal.addEventListener('abort', onAbort, { once: true });
});

const toBlock = (element: Element, tag: string, listTag?: 'ul' | 'ol'): TimelapseBlock => {
    const textual = (listTag !== undefined || TEXT_BLOCK_TAGS.has(tag)) && !element.querySelector(MEDIA_SELECTOR);
    const rawText = element.textContent ?? '';
    const block: TimelapseBlock = {
        tag,
        html: listTag ? element.innerHTML : element.outerHTML,
        textual,
        text: textual ? (tag === 'pre' ? rawText : rawText.trim()) : element.outerHTML
    };
    if (listTag) block.listTag = listTag;
    return block;
};

export const parseFrameHtml = (title: string, html: string): ParsedFrame => {
    const parsed = new DOMParser().parseFromString(html, 'text/html');
    const blocks: TimelapseBlock[] = [];
    parsed.body.childNodes.forEach((node) => {
        if (node.nodeType === Node.TEXT_NODE) {
            const text = node.textContent?.trim();
            if (text) {
                const paragraph = parsed.createElement('p');
                paragraph.textContent = text;
                blocks.push(toBlock(paragraph, 'p'));
            }
            return;
        }
        if (!(node instanceof Element)) return;
        const tag = node.tagName.toLowerCase();
        if (tag === 'ul' || tag === 'ol') {
            Array.from(node.children)
                .filter((item) => item.tagName.toLowerCase() === 'li')
                .forEach((item) => blocks.push(toBlock(item, 'li', tag)));
            return;
        }
        blocks.push(toBlock(node, tag));
    });
    return {
        title,
        blocks
    };
};

const fromMarkup = (block: TimelapseBlock): HTMLElement => {
    if (block.listTag) {
        const item = document.createElement('li');
        item.innerHTML = block.html;
        return item;
    }
    const template = document.createElement('template');
    template.innerHTML = block.html;
    const element = template.content.firstElementChild;
    return element instanceof HTMLElement ? element : document.createElement('div');
};

/** Changed text is shown as plain text while it animates; formatting returns when the step ends. */
const createTextBlock = (block: TimelapseBlock) => {
    const element = document.createElement(block.tag);
    if (block.tag !== 'pre') return {
        element,
        host: element
    };
    const code = document.createElement('code');
    element.append(code);
    return {
        element,
        host: code
    };
};

const createMark = (op: TextOp, mode: 'static' | 'animate') => {
    const span = document.createElement('span');
    span.dataset.op = op.kind;
    if (op.kind === 'insert') {
        span.className = MARK_CLASS.insert;
        if (mode === 'animate') {
            span.dataset.text = op.text;
            span.append(document.createTextNode(''));
        } else {
            span.textContent = op.text;
        }
    } else {
        span.className = MARK_CLASS.delete;
        span.textContent = op.text;
        if (mode === 'animate') span.dataset.pending = '';
    }
    return span;
};

const appendOps = (host: HTMLElement, ops: TextOp[], mode: 'static' | 'animate') => {
    ops.forEach((op) => {
        host.append(op.kind === 'equal' ? document.createTextNode(op.text) : createMark(op, mode));
    });
};

const renderChange = (change: BlockChange, mode: 'static' | 'animate'): HTMLElement => {
    const { block } = change;
    if (change.kind === 'same') return fromMarkup(block);

    if (change.kind === 'edit') {
        const { element, host } = createTextBlock(block);
        appendOps(host, change.ops, mode);
        return element;
    }

    if (!block.textual) {
        const element = fromMarkup(block);
        if (change.kind === 'insert') {
            element.classList.add(MARK_CLASS.insertedMedia);
            element.dataset.insertedMedia = '';
            if (mode === 'animate') element.dataset.pending = '';
        } else {
            element.classList.add(MARK_CLASS.deletedMedia);
            element.dataset.removed = '';
        }
        return element;
    }

    const { element, host } = createTextBlock(block);
    appendOps(host, [{
        kind: change.kind,
        text: block.text
    }], mode);
    if (change.kind === 'delete') {
        element.dataset.removed = '';
    } else if (mode === 'animate') {
        element.dataset.waiting = '';
    }
    return element;
};

export const renderFrame = (stage: TimelapseStage, title: string, contentHtml: string) => {
    stage.title.textContent = title;
    stage.content.innerHTML = contentHtml;
};

export const renderDiff = (stage: TimelapseStage, diff: FrameDiff, mode: 'static' | 'animate') => {
    stage.title.replaceChildren();
    appendOps(stage.title, diff.title, mode);

    const fragment = document.createDocumentFragment();
    let list: HTMLElement | null = null;
    diff.blocks.forEach((change) => {
        const element = renderChange(change, mode);
        const { listTag } = change.block;
        if (!listTag) {
            list = null;
            fragment.append(element);
            return;
        }
        if (!list || list.tagName.toLowerCase() !== listTag) {
            list = document.createElement(listTag);
            fragment.append(list);
        }
        list.append(element);
    });
    stage.content.replaceChildren(fragment);
};

const firstChange = (stage: TimelapseStage) => (
    stage.title.querySelector<HTMLElement>('[data-op]')
    ?? stage.content.querySelector<HTMLElement>('[data-op], [data-inserted-media], [data-removed]')
);

const visibleAnchor = (element: HTMLElement) => {
    const waitingBlock = element.closest<HTMLElement>('[data-waiting]');
    if (!waitingBlock) return element;
    let sibling = waitingBlock.previousElementSibling;
    while (sibling instanceof HTMLElement && sibling.dataset.waiting !== undefined) {
        sibling = sibling.previousElementSibling;
    }
    return sibling instanceof HTMLElement ? sibling : waitingBlock.parentElement ?? element;
};

export const focusChange = (stage: TimelapseStage, reducedMotion: boolean) => {
    const change = firstChange(stage);
    if (!change) return;
    const behavior: ScrollBehavior = reducedMotion ? 'auto' : 'smooth';
    if (stage.title.contains(change)) {
        stage.scroller.scrollTo({
            top: 0,
            behavior
        });
        return;
    }
    const anchor = visibleAnchor(change);
    const scrollerBox = stage.scroller.getBoundingClientRect();
    const box = anchor.getBoundingClientRect();
    const top = box.top - scrollerBox.top;
    const bottom = box.bottom - scrollerBox.top;
    if (top < HEADER_CLEARANCE || bottom > stage.scroller.clientHeight - BAR_CLEARANCE) {
        stage.scroller.scrollTo({
            top: stage.scroller.scrollTop + top - stage.scroller.clientHeight * 0.3,
            behavior
        });
    }
};

const followCaret = (stage: TimelapseStage, caret: HTMLElement) => {
    const scrollerBox = stage.scroller.getBoundingClientRect();
    const box = caret.getBoundingClientRect();
    const top = box.top - scrollerBox.top;
    if (top < HEADER_CLEARANCE || box.bottom - scrollerBox.top > stage.scroller.clientHeight - BAR_CLEARANCE) {
        stage.scroller.scrollTo({
            top: stage.scroller.scrollTop + top - stage.scroller.clientHeight * 0.4,
            behavior: 'smooth'
        });
        return true;
    }
    return false;
};

const collapse = (element: HTMLElement) => {
    element.style.overflow = 'hidden';
    element.style.maxHeight = `${element.offsetHeight}px`;
    void element.offsetHeight;
    element.style.transition = `max-height ${TIMING.collapseDeletion}ms ease, margin ${TIMING.collapseDeletion}ms ease, opacity 260ms ease`;
    element.style.maxHeight = '0px';
    element.style.marginTop = '0px';
    element.style.marginBottom = '0px';
    element.style.opacity = '0';
};

interface TypingTarget {
    element: HTMLElement;
    characters: string[];
    units: number;
}

const typeInsertions = (stage: TimelapseStage, signal: AbortSignal, getSpeed: () => number) => {
    const targets: TypingTarget[] = [stage.title, stage.content].flatMap((root) => (
        Array.from(root.querySelectorAll<HTMLElement>('[data-op="insert"][data-text], [data-inserted-media]'))
    )).map((element) => {
        const characters = Array.from(element.dataset.text ?? '');
        return {
            element,
            characters,
            units: element.dataset.insertedMedia !== undefined ? MEDIA_TYPING_UNITS : characters.length
        };
    });
    const totalUnits = targets.reduce((total, target) => total + target.units, 0);
    if (!totalUnits) return Promise.resolve(!signal.aborted);

    const duration = Math.min(
        TIMING.maxTyping,
        Math.max(TIMING.minTyping, totalUnits * TIMING.msPerCharacter)
    ) / getSpeed();
    const caret = document.createElement('span');
    caret.className = MARK_CLASS.caret;
    caret.setAttribute('aria-hidden', 'true');
    let lastCameraMove = 0;

    return new Promise<boolean>((resolve) => {
        const startedAt = performance.now();
        const frame = (now: number) => {
            if (signal.aborted) {
                caret.remove();
                resolve(false);
                return;
            }
            const progress = Math.min(1, (now - startedAt) / duration);
            let remaining = Math.round(totalUnits * progress);
            let active: TypingTarget | undefined;

            for (const target of targets) {
                const shown = Math.min(target.units, remaining);
                remaining -= shown;
                if (shown > 0) {
                    const waitingBlock = target.element.closest<HTMLElement>('[data-waiting]');
                    if (waitingBlock) delete waitingBlock.dataset.waiting;
                }
                if (target.element.dataset.insertedMedia !== undefined) {
                    if (shown > 0) delete target.element.dataset.pending;
                    continue;
                }
                const text = target.characters.slice(0, shown).join('');
                const node = target.element.firstChild;
                if (node instanceof Text && node.data !== text) node.data = text;
                if (!active && shown < target.units) active = target;
            }

            const typing = active ?? [...targets].reverse().find((target) => target.characters.length);
            if (typing && caret.previousSibling !== typing.element) typing.element.after(caret);
            if (now - lastCameraMove > TIMING.cameraCooldown && caret.isConnected && followCaret(stage, caret)) {
                lastCameraMove = now;
            }

            if (progress < 1) {
                requestAnimationFrame(frame);
                return;
            }
            setTimeout(() => caret.remove(), TIMING.settle / getSpeed());
            resolve(true);
        };
        requestAnimationFrame(frame);
    });
};

/** Plays one save-to-save step. Resolves false as soon as the signal aborts. */
export const playStep = async ({
    stage, diff, signal, getSpeed, reducedMotion
}: StepOptions) => {
    const pause = (ms: number) => wait(ms / getSpeed(), signal);

    if (reducedMotion) {
        renderDiff(stage, diff, 'static');
        focusChange(stage, true);
        return pause(TIMING.reducedMotionStep);
    }

    renderDiff(stage, diff, 'animate');
    focusChange(stage, false);
    if (!await pause(TIMING.lookBeforeChange)) return false;

    const roots = [stage.title, stage.content];
    const deletions = roots.flatMap((root) => Array.from(root.querySelectorAll<HTMLElement>('[data-op="delete"]')));
    const removedBlocks = Array.from(stage.content.querySelectorAll<HTMLElement>('[data-removed]'));
    if (deletions.length || removedBlocks.length) {
        deletions.forEach((mark) => delete mark.dataset.pending);
        if (!await pause(TIMING.holdDeletion)) return false;
        deletions.forEach((mark) => {
            mark.dataset.gone = '';
        });
        removedBlocks.forEach(collapse);
        if (!await pause(TIMING.collapseDeletion)) return false;
        deletions.forEach((mark) => mark.remove());
        removedBlocks.forEach((block) => block.remove());
    }

    if (!await typeInsertions(stage, signal, getSpeed)) return false;
    if (!await pause(TIMING.holdAfterTyping)) return false;
    roots.forEach((root) => {
        root.querySelectorAll<HTMLElement>('[data-op="insert"]').forEach((mark) => {
            mark.dataset.settled = '';
        });
    });
    return pause(TIMING.settle);
};
