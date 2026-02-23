import { Document } from '@tiptap/extension-document';
import { Paragraph } from '@tiptap/extension-paragraph';
import { Text } from '@tiptap/extension-text';
import { Bold } from '@tiptap/extension-bold';
import { Italic } from '@tiptap/extension-italic';
import { Strike } from '@tiptap/extension-strike';
import { Code } from '@tiptap/extension-code';
import { Heading } from '@tiptap/extension-heading';
import { BulletList } from '@tiptap/extension-bullet-list';
import { OrderedList } from '@tiptap/extension-ordered-list';
import { ListItem } from '@tiptap/extension-list-item';
import { Blockquote } from '@tiptap/extension-blockquote';
import { HorizontalRule } from '@tiptap/extension-horizontal-rule';
import { HardBreak } from '@tiptap/extension-hard-break';
import { History } from '@tiptap/extension-history';
import { Dropcursor } from '@tiptap/extension-dropcursor';
import { Gapcursor } from '@tiptap/extension-gapcursor';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import Typography from '@tiptap/extension-typography';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableHeader } from '@tiptap/extension-table-header';
import { TableCell } from '@tiptap/extension-table-cell';
import { Color } from '@tiptap/extension-color';
import { TextStyle } from '@tiptap/extension-text-style';
import { Highlight } from '@tiptap/extension-highlight';
import { Underline } from '@tiptap/extension-underline';
import { Subscript } from '@tiptap/extension-subscript';
import { Superscript } from '@tiptap/extension-superscript';
import { TextAlign } from '@tiptap/extension-text-align';
import { IframeNode } from '../extensions/IframeNode';
import { VideoNode } from '../extensions/VideoNode';
import { CustomImage } from '../extensions/CustomImage';
import { CodeBlockWithLanguageSelector } from '../extensions/CodeBlockWithLanguageSelector';
import { ColumnsNode, ColumnNode } from '../extensions/ColumnsNode';
import { editorLowlight } from './lowlightConfig';

export const getEditorExtensions = (placeholder: string) => [
    Document,
    Paragraph,
    Text,
    Bold,
    Italic,
    Strike,
    Code,
    Heading,
    BulletList,
    OrderedList,
    ListItem,
    Blockquote,
    HorizontalRule,
    HardBreak,
    History,
    Dropcursor,
    Gapcursor,
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
        lowlight: editorLowlight,
        defaultLanguage: 'plaintext'
    }),
    Table,
    TableRow,
    TableHeader,
    TableCell,
    IframeNode,
    VideoNode,
    ColumnsNode,
    ColumnNode
];
