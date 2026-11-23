import {
    getLanguageLabel,
    getLanguageLoader,
    highlightElement,
    registerLanguage
} from '../editor/tiptap/utils/languages';

const COPIED_RESET_MS = 2000;
const copyIcon =
    '<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>';
const checkIcon =
    '<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>';

const loadedLanguages = new Set<string>();
const activeMounts = new WeakMap<ParentNode, () => void>();

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

function copyButton(code: HTMLElement, signal: AbortSignal) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'code-copy-button';
    button.title = 'Copy code';
    button.setAttribute('aria-label', 'Copy code');
    button.innerHTML = copyIcon;
    let reset: ReturnType<typeof setTimeout> | undefined;
    signal.addEventListener('abort', () => clearTimeout(reset), { once: true });
    button.addEventListener(
        'click',
        async () => {
            try {
                await navigator.clipboard.writeText(code.textContent ?? '');
            } catch (error) {
                console.error('Could not copy the code.', error);
                return;
            }
            button.innerHTML = checkIcon;
            button.title = 'Copied!';
            clearTimeout(reset);
            reset = setTimeout(() => {
                button.innerHTML = copyIcon;
                button.title = 'Copy code';
            }, COPIED_RESET_MS);
        },
        { signal }
    );
    return button;
}

function decorate(code: HTMLElement, language: string, signal: AbortSignal) {
    const pre = code.parentElement;
    if (!pre?.parentElement || pre.parentElement.classList.contains('code-block-wrapper')) return;
    highlightElement(code);

    const wrapper = document.createElement('div');
    wrapper.className = 'code-block-wrapper';
    const header = document.createElement('div');
    header.className = 'code-block-header';
    const label = document.createElement('span');
    label.className = 'code-language';
    label.textContent = getLanguageLabel(language);
    header.append(label, copyButton(code, signal));
    wrapper.append(header);
    pre.parentElement.insertBefore(wrapper, pre);
    wrapper.append(pre);
    pre.classList.add('hljs');
}

async function decorateAll(blocks: HTMLElement[], signal: AbortSignal) {
    const languages = new Set(blocks.map(languageOf).filter((language): language is string => language !== null));
    await Promise.all(Array.from(languages, loadLanguage));
    if (signal.aborted) return;
    for (const code of blocks) {
        const language = languageOf(code);
        if (language) decorate(code, language, signal);
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
