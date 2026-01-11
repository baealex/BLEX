import {
    getLanguageLoader,
    getLanguageLabel,
    registerLanguage,
    highlightElement
} from '@blex/editor';

const loadedLanguages = new Set<string>();

function createCopyButton(codeElement: HTMLElement): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'code-copy-button';
    button.title = 'Copy code';

    const copyIcon = `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>`;

    const checkIcon = `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
    </svg>`;

    button.innerHTML = copyIcon;

    button.addEventListener('click', async () => {
        try {
            const code = codeElement.textContent || '';
            await navigator.clipboard.writeText(code);
            button.innerHTML = checkIcon;
            button.title = 'Copied!';
            setTimeout(() => {
                button.innerHTML = copyIcon;
                button.title = 'Copy code';
            }, 2000);
        } catch (err) {
            console.error('Failed to copy code:', err);
        }
    });

    return button;
}

async function loadLanguage(language: string): Promise<void> {
    if (loadedLanguages.has(language)) {
        return;
    }

    const loader = getLanguageLoader(language);
    if (loader) {
        try {
            const module = await loader();
            registerLanguage(language, module.default);
            loadedLanguages.add(language);
        } catch (error) {
            console.warn(`Failed to load language: ${language}`, error);
        }
    }
}

async function processCodeBlocks() {
    const codeBlocks = document.querySelectorAll('pre > code[class*="language-"]') as NodeListOf<HTMLElement>;

    const languagesInUse = new Set<string>();

    codeBlocks.forEach((codeElement) => {
        const languageClass = codeElement.className.match(/language-(\w+)/);
        if (languageClass) {
            languagesInUse.add(languageClass[1]);
        }
    });

    const loadPromises = Array.from(languagesInUse).map(lang => loadLanguage(lang));
    await Promise.all(loadPromises);

    codeBlocks.forEach((codeElement) => {
        const preElement = codeElement.parentElement as HTMLPreElement;
        const languageClass = codeElement.className.match(/language-(\w+)/);

        if (languageClass && preElement && !preElement.parentElement?.classList.contains('code-block-wrapper')) {
            const language = languageClass[1];

            highlightElement(codeElement);

            const wrapper = document.createElement('div');
            wrapper.className = 'code-block-wrapper';

            const header = document.createElement('div');
            header.className = 'code-block-header';

            const languageSpan = document.createElement('span');
            languageSpan.className = 'code-language';
            languageSpan.textContent = getLanguageLabel(language);

            const copyButton = createCopyButton(codeElement);

            header.appendChild(languageSpan);
            header.appendChild(copyButton);
            wrapper.appendChild(header);

            preElement.parentElement?.insertBefore(wrapper, preElement);
            wrapper.appendChild(preElement);

            preElement.classList.add('hljs');
        }
    });
}

export async function initializeSyntaxHighlighting() {
    await processCodeBlocks();
}

let mutationObserver: MutationObserver | null = null;

function watchForNewCodeBlocks() {
    if ('MutationObserver' in window && !mutationObserver) {
        mutationObserver = new MutationObserver(async (mutations) => {
            let hasNewCodeBlocks = false;

            mutations.forEach((mutation) => {
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            const element = node as Element;

                            if (element.matches?.('pre > code[class*="language-"]') ||
                                element.querySelector?.('pre > code[class*="language-"]')) {
                                hasNewCodeBlocks = true;
                            }
                        }
                    });
                }
            });

            if (hasNewCodeBlocks) {
                await processCodeBlocks();
            }
        });

        mutationObserver.observe(document.body, {
            childList: true,
            subtree: true
        });
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    await initializeSyntaxHighlighting();
    watchForNewCodeBlocks();
});

export { processCodeBlocks };
