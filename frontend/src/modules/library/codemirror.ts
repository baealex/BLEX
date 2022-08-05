import { getMode } from './codemirror.helper';

import 'codemirror/lib/codemirror.css';
import 'codemirror/theme/material-darker.css';

export async function codeMirrorAll() {
    if (typeof window !== 'undefined') {
        const CodeMirror = (await import('codemirror')).default;

        const elements = document.getElementsByTagName('pre');
        Array.from(elements).forEach(async element => {
            const language = element.firstElementChild?.className.replace(/language-(.*)/, '$1');
            const { textContent } = element;

            const textarea = document.createElement('textarea');
            textarea.style.display = 'none';
            textarea.value = textContent?.trimEnd() || '';
            element.replaceWith(textarea);

            CodeMirror.fromTextArea(textarea, {
                mode: await getMode(language || ''),
                viewportMargin: Infinity,
                lineNumbers: true,
                readOnly: true,
                theme: 'material-darker'
            });
        });
    }
}
