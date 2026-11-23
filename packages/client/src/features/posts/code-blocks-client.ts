import { createElement } from 'react';
import { renderIsland } from '../../application/island';
import {
    getLanguageLabel,
    getLanguageLoader,
    highlightElement,
    registerLanguage
} from '../editor/tiptap/utils/languages';
import { CodeBlockHeader } from './code-block-header';

const loadedLanguages = new Set<string>();
const activeMounts = new WeakMap<ParentNode, () => void>();
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

async function decorateAll(blocks: HTMLElement[], signal: AbortSignal) {
    const languages = new Set(blocks.map(languageOf).filter((language): language is string => language !== null));
    await Promise.all(Array.from(languages, loadLanguage));
    if (signal.aborted) return;
    for (const code of blocks) {
        const language = languageOf(code);
        const header = language ? headerFor(code) : null;
        if (language && header)
            renderIsland(header, createElement(CodeBlockHeader, { code, label: getLanguageLabel(language) }), signal);
    }
}

export function mountPage(scope: ParentNode): (() => void) | undefined {
    const active = activeMounts.get(scope);
    if (active) return active;
    const blocks = Array.from(scope.querySelectorAll<HTMLElement>('.blog-post-content pre > code[class*="language-"]'));
    if (!blocks.length) return undefined;
    const controller = new AbortController();
    const cleanup = () => {
        controller.abort();
        activeMounts.delete(scope);
    };
    activeMounts.set(scope, cleanup);
    void decorateAll(blocks, controller.signal);
    return cleanup;
}

if (typeof document !== 'undefined' && !document.getElementById('blex-application')) {
    mountPage(document);
}
