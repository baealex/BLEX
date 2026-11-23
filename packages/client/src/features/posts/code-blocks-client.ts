import {
    getLanguageLabel,
    getLanguageLoader,
    highlightElement,
    registerLanguage
} from '../editor/tiptap/utils/languages';

export interface DecoratedCodeBlock {
    code: HTMLElement;
    header: HTMLElement;
    label: string;
}

const loadedLanguages = new Set<string>();
const decoratedHeaders = new WeakMap<HTMLElement, HTMLElement>();

function languageOf(code: HTMLElement) {
    return code.className.match(/language-(\w+)/)?.[1] ?? null;
}

async function loadLanguage(language: string) {
    if (loadedLanguages.has(language)) return;
    const loader = getLanguageLoader(language);
    if (!loader) return;
    try {
        registerLanguage(language, (await loader()).default);
        loadedLanguages.add(language);
    } catch (error) {
        console.warn(`Could not load the ${language} code language.`, error);
    }
}

/** Wraps a block once. A page whose HTML did not change keeps its wrapper, so the header is reused. */
function headerFor(code: HTMLElement): HTMLElement | null {
    const existing = decoratedHeaders.get(code);
    if (existing) return existing;
    const pre = code.parentElement;
    const parent = pre?.parentElement;
    if (!pre || !parent || parent.classList.contains('code-block-wrapper')) return null;
    highlightElement(code);

    const wrapper = document.createElement('div');
    wrapper.className = 'code-block-wrapper';
    const header = document.createElement('div');
    header.className = 'code-block-header';
    wrapper.append(header);
    parent.insertBefore(wrapper, pre);
    wrapper.append(pre);
    pre.classList.add('hljs');
    decoratedHeaders.set(code, header);
    return header;
}

/** Highlights the blocks in `body` and returns the header each one needs its controls rendered into. */
export async function decorateCodeBlocks(body: ParentNode, signal: AbortSignal): Promise<DecoratedCodeBlock[]> {
    const blocks = Array.from(body.querySelectorAll<HTMLElement>('pre > code[class*="language-"]'));
    const languages = new Set(blocks.map(languageOf).filter((language): language is string => language !== null));
    await Promise.all(Array.from(languages, loadLanguage));
    if (signal.aborted) return [];
    const decorated: DecoratedCodeBlock[] = [];
    for (const code of blocks) {
        const language = languageOf(code);
        const header = language ? headerFor(code) : null;
        if (language && header)
            decorated.push({
                code,
                header,
                label: getLanguageLabel(language)
            });
    }
    return decorated;
}
