import { Extension, Node } from '@tiptap/core';
import Image from '@tiptap/extension-image';
import { TableKit } from '@tiptap/extension-table';
import { Fragment, Slice } from '@tiptap/pm/model';
import { EditorContent, useEditor, useEditorState } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useRef, useState } from 'react';
import type { ChangeEvent } from 'react';

const legacyFormatting = Extension.create({
  name: 'legacyFormatting',
  addGlobalAttributes() {
    return [{
      types: ['paragraph', 'heading', 'image', 'blockquote', 'codeBlock', 'table', 'tableCell', 'tableHeader'],
      attributes: {
        id: { default: null },
        class: { default: null },
        style: { default: null },
      },
    }];
  },
});

// Initial HTML is sanitized by the same server renderer used for public posts.
// Treat legacy media and column layouts as blocks so opening the editor preserves their structure.
const legacyBlock = Node.create({
  name: 'legacyBlock',
  group: 'block',
  atom: true,
  addAttributes() { return { markup: { default: '', rendered: false } }; },
  parseHTML() {
    return ['figure', 'video', 'iframe', 'div'].map((tag) => ({
      tag,
      getAttrs: (element: HTMLElement) => ({ markup: element.outerHTML }),
    }));
  },
  renderHTML({ node }) {
    const template = document.createElement('template');
    template.innerHTML = String(node.attrs.markup);
    return (template.content.firstElementChild as HTMLElement | null) ?? ['p'];
  },
});

function allowedUrl(value: string, image: boolean) {
  if (/^\/(?![/\\])/.test(value) && !/[\\\u0000-\u0020]/.test(value)) return true;
  const url = URL.parse(value);
  if (!url || url.username || url.password) return false;
  return url.protocol === 'https:' || (!image && (url.protocol === 'http:' || url.protocol === 'mailto:'));
}

export default function VisualEditor({ initialHtml, onEdit, onImageUpload }: {
  initialHtml: string;
  onEdit: (value: string) => void;
  onImageUpload?: (file: File) => Promise<string>;
}) {
  const [insert, setInsert] = useState<'link' | 'image' | null>(null);
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const imageInput = useRef<HTMLInputElement>(null);
  const editor = useEditor({
    extensions: [StarterKit.configure({ link: { openOnClick: false } }), Image, TableKit, legacyFormatting, legacyBlock],
    content: initialHtml,
    immediatelyRender: false,
    editorProps: {
      attributes: { role: 'textbox', 'aria-label': '서식 본문', 'aria-multiline': 'true' },
      handlePaste(view, event) {
        const file = event.clipboardData?.files.item(0);
        if (file?.type.startsWith('image/') && onImageUpload) {
          event.preventDefault();
          void onImageUpload(file).then((src) => {
            const image = view.state.schema.nodes.image?.create({ src });
            if (image) view.dispatch(view.state.tr.replaceSelectionWith(image).scrollIntoView());
          }).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : '이미지를 올리지 못했습니다.'));
          return true;
        }
        const text = event.clipboardData?.getData('text/plain') ?? '';
        if (!text) return false;
        const schema = view.state.schema;
        const paragraphs = text.split(/\r?\n/).map((line) => schema.nodes.paragraph.create(null, line ? schema.text(line) : undefined));
        view.dispatch(view.state.tr.replaceSelection(new Slice(Fragment.fromArray(paragraphs), 1, 1)).scrollIntoView());
        return true;
      },
      handleDrop(view, event, _slice, moved) {
        const file = event.dataTransfer?.files.item(0);
        if (moved || !file?.type.startsWith('image/') || !onImageUpload) return false;
        event.preventDefault();
        const position = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos ?? view.state.selection.from;
        void onImageUpload(file).then((src) => {
          const image = view.state.schema.nodes.image?.create({ src });
          if (!image) return;
          const safePosition = Math.min(position, view.state.doc.content.size);
          view.dispatch(view.state.tr.insert(safePosition, image).scrollIntoView());
        }).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : '이미지를 올리지 못했습니다.'));
        return true;
      },
    },
    onUpdate: ({ editor }) => onEdit(editor.isEmpty ? '' : editor.getHTML()),
  });
  const active = useEditorState({ editor, selector: ({ editor }) => ({
    bold: editor?.isActive('bold'), italic: editor?.isActive('italic'), heading: editor?.isActive('heading', { level: 2 }),
    list: editor?.isActive('bulletList'), code: editor?.isActive('codeBlock'),
  }) });
  if (!editor) return null;

  function select(kind: 'link' | 'image') {
    setInsert(kind === insert ? null : kind);
    setUrl(kind === 'link' ? String(editor?.getAttributes('link').href ?? '') : '');
    setError('');
  }

  function applyUrl() {
    const address = url.trim();
    if (!editor || !insert || !allowedUrl(address, insert === 'image')) {
      setError('주소를 확인해 주세요.');
      return;
    }
    if (insert === 'image') editor.chain().focus().setImage({ src: address }).run();
    else editor.chain().focus().extendMarkRange('link').setLink({ href: address }).run();
    setInsert(null);
  }

  async function uploadSelectedImage(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.item(0);
    if (!editor || !file || !onImageUpload) return;
    setUploading(true);
    setError('');
    try {
      const src = await onImageUpload(file);
      editor.chain().focus().setImage({ src }).run();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '이미지를 올리지 못했습니다.');
    } finally {
      setUploading(false);
      input.value = '';
    }
  }

  return <div className="editor-visual">
    <div className="editor-toolbar" role="group" aria-label="본문 서식">
      <button type="button" aria-pressed={active?.bold ?? false} onClick={() => editor.chain().focus().toggleBold().run()}>굵게</button>
      <button type="button" aria-pressed={active?.italic ?? false} onClick={() => editor.chain().focus().toggleItalic().run()}>기울임</button>
      <button type="button" aria-pressed={active?.heading ?? false} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>소제목</button>
      <button type="button" aria-pressed={active?.list ?? false} onClick={() => editor.chain().focus().toggleBulletList().run()}>목록</button>
      <button type="button" aria-pressed={active?.code ?? false} onClick={() => editor.chain().focus().toggleCodeBlock().run()}>코드 블록</button>
      <button type="button" aria-expanded={insert === 'link'} onClick={() => select('link')}>링크</button>
      <button type="button" aria-expanded={insert === 'image'} onClick={() => select('image')}>이미지</button>
      {onImageUpload && <><button type="button" disabled={uploading} onClick={() => imageInput.current?.click()}>{uploading ? '올리는 중…' : '이미지 올리기'}</button>
        <input ref={imageInput} className="editor-image-file-input" type="file" accept="image/jpeg,image/png,image/gif,image/webp" onChange={uploadSelectedImage} /></>}
      <button type="button" onClick={() => editor.chain().focus().insertTable({ rows: 2, cols: 2, withHeaderRow: true }).run()}>표</button>
      <button type="button" onClick={() => editor.chain().focus().undo().run()}>실행 취소</button>
    </div>
    {insert && <div className="editor-url-entry">
      <label> {insert === 'image' ? '이미지 주소' : '링크 주소'} <input inputMode="url" value={url} onChange={(event) => setUrl(event.currentTarget.value)}
        onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); applyUrl(); } }} /></label>
      <button type="button" onClick={applyUrl}>적용</button>
      {insert === 'link' && <button type="button" onClick={() => { editor.chain().focus().unsetLink().run(); setInsert(null); }}>링크 제거</button>}
    </div>}
    {error && <p className="editor-image-error" role="alert">{error}</p>}
    <EditorContent editor={editor} />
  </div>;
}
