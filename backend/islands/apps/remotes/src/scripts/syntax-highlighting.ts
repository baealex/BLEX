import {
    getLanguageLoader,
    getLanguageLabel,
    registerLanguage,
    highlightElement
} from '@blex/editor';

const loadedLanguages = new Set<string>();

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

            header.appendChild(languageSpan);
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
