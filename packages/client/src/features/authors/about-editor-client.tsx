import { hydrateIsland } from '../../application/island.js';
import { AboutEditor, AboutPageEditor } from './about-editor.js';

/** Follows the writer's text and caret until hydration commits, then restores them on the hydrated textarea. */
function followDraft(input: HTMLTextAreaElement, signal: AbortSignal) {
    const read = () => ({ value: input.value, start: input.selectionStart, end: input.selectionEnd });
    let draft = read();
    const record = () => {
        draft = read();
    };
    input.addEventListener('input', record, { signal });
    return (hydrated: HTMLTextAreaElement) => {
        input.removeEventListener('input', record);
        if (hydrated.value === draft.value) return;
        hydrated.value = draft.value;
        hydrated.setSelectionRange(draft.start, draft.end);
    };
}

export function mountAboutEditors(signal: AbortSignal): void {
    for (const page of document.querySelectorAll<HTMLElement>('[data-about-page]')) {
        const input = page.querySelector<HTMLTextAreaElement>('[data-about-input]');
        if (!input) continue;
        hydrateIsland(
            page,
            <AboutPageEditor
                aboutMarkdown={input.defaultValue}
                onHydrated={followDraft(input, signal)}
                saveUrl={page.dataset.aboutUrl ?? ''}
                returnPath={page.dataset.aboutReturn ?? '/'}
            />,
            signal
        );
    }

    for (const section of document.querySelectorAll<HTMLElement>('[data-about-editor]')) {
        const input = section.querySelector<HTMLTextAreaElement>('[data-about-input]');
        const content = section.querySelector<HTMLElement>('[data-about-content]');
        if (!input || !content) continue;
        hydrateIsland(
            section,
            <AboutEditor
                aboutHtml={content.innerHTML}
                aboutMarkdown={input.defaultValue}
                editPath={section.dataset.aboutUrl ?? ''}
            />,
            signal
        );
    }
}
