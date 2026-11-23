import { hydrateIsland } from '../../application/island.js';
import { AboutEditor, AboutPageEditor } from './about-editor.js';

const draftEvents = ['input', 'keydown', 'selectionchange'];

/**
 * Follows the writer's text and caret until hydration commits, then restores them on the hydrated textarea.
 * A key press can make React hydrate during that event, so this listens on the window ahead of React's root.
 */
function followDraft(input: HTMLTextAreaElement, signal: AbortSignal) {
    const read = () => ({ value: input.value, start: input.selectionStart, end: input.selectionEnd });
    let draft = read();
    const record = (event: Event) => {
        if (event.target === input || document.activeElement === input) draft = read();
    };
    for (const type of draftEvents) window.addEventListener(type, record, { capture: true, signal });
    return (hydrated: HTMLTextAreaElement) => {
        for (const type of draftEvents) window.removeEventListener(type, record, { capture: true });
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
