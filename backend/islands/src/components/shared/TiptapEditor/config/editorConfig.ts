import { StarterKit } from '@tiptap/starter-kit';
import { Color } from '@tiptap/extension-color';
import { TextStyle } from '@tiptap/extension-text-style';
import { Highlight } from '@tiptap/extension-highlight';
import { Underline } from '@tiptap/extension-underline';
import { Subscript } from '@tiptap/extension-subscript';
import { Superscript } from '@tiptap/extension-superscript';
import { TextAlign } from '@tiptap/extension-text-align';
import { common, createLowlight } from 'lowlight';
import { IframeNode } from '../extensions/IframeNode';
import { VideoNode } from '../extensions/VideoNode';
import { CustomImage } from '../extensions/CustomImage';
import { CodeBlockWithLanguageSelector } from '../extensions/CodeBlockWithLanguageSelector';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import Typography from '@tiptap/extension-typography';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableHeader } from '@tiptap/extension-table-header';
import { TableCell } from '@tiptap/extension-table-cell';

const customLowlight = createLowlight(common);

export const getEditorExtensions = (placeholder: string) => [
    StarterKit.configure({ codeBlock: false }),
    CustomImage,
    Link.configure({ openOnClick: false }),
    Placeholder.configure({ placeholder }),
    Typography,
    TextStyle,
    Color,
    Highlight.configure({ multicolor: true }),
    Underline,
    Subscript,
    Superscript,
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    CodeBlockWithLanguageSelector.configure({
        lowlight: customLowlight,
        defaultLanguage: 'plaintext'
    }),
    Table,
    TableRow,
    TableHeader,
    TableCell,
    IframeNode,
    VideoNode
];
