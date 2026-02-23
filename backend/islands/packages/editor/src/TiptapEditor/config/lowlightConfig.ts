import type { LanguageFn } from 'highlight.js';
import { createLowlight } from 'lowlight';
import bash from 'highlight.js/lib/languages/bash';
import c from 'highlight.js/lib/languages/c';
import cpp from 'highlight.js/lib/languages/cpp';
import csharp from 'highlight.js/lib/languages/csharp';
import css from 'highlight.js/lib/languages/css';
import dockerfile from 'highlight.js/lib/languages/dockerfile';
import go from 'highlight.js/lib/languages/go';
import java from 'highlight.js/lib/languages/java';
import javascript from 'highlight.js/lib/languages/javascript';
import json from 'highlight.js/lib/languages/json';
import kotlin from 'highlight.js/lib/languages/kotlin';
import markdown from 'highlight.js/lib/languages/markdown';
import php from 'highlight.js/lib/languages/php';
import python from 'highlight.js/lib/languages/python';
import ruby from 'highlight.js/lib/languages/ruby';
import rust from 'highlight.js/lib/languages/rust';
import scss from 'highlight.js/lib/languages/scss';
import sql from 'highlight.js/lib/languages/sql';
import swift from 'highlight.js/lib/languages/swift';
import typescript from 'highlight.js/lib/languages/typescript';
import xml from 'highlight.js/lib/languages/xml';
import yaml from 'highlight.js/lib/languages/yaml';

const lowlight = createLowlight();

const languageRegistrations: Array<[string, LanguageFn]> = [
    ['javascript', javascript],
    ['typescript', typescript],
    ['python', python],
    ['java', java],
    ['cpp', cpp],
    ['c', c],
    ['csharp', csharp],
    ['php', php],
    ['ruby', ruby],
    ['go', go],
    ['rust', rust],
    ['kotlin', kotlin],
    ['swift', swift],
    ['html', xml],
    ['xml', xml],
    ['css', css],
    ['scss', scss],
    ['json', json],
    ['yaml', yaml],
    ['markdown', markdown],
    ['bash', bash],
    ['shell', bash],
    ['sql', sql],
    ['dockerfile', dockerfile]
];

for (const [name, languageFn] of languageRegistrations) {
    lowlight.register(name, languageFn);
}

export const editorLowlight = lowlight;
