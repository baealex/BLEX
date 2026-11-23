import { hydrateIsland } from '../../application/island.js';
import { AboutEditor, AboutPageEditor } from './about-editor.js';

export function mountAboutEditors(signal: AbortSignal): void {
    for (const page of document.querySelectorAll<HTMLElement>('[data-about-page]')) {
        const input = page.querySelector<HTMLTextAreaElement>('[data-about-input]');
        if (!input) continue;
        hydrateIsland(
            page,
            <AboutPageEditor
                aboutMarkdown={input.defaultValue}
                draft={input.value}
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
