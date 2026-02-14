import { Node, mergeAttributes } from '@tiptap/react';

export type ColumnLayout = '1:1' | '1:2' | '2:1' | '1:1:1' | '1:2:1' | '2:1:1' | '1:1:2';

export interface ColumnsAttributes {
    layout: ColumnLayout;
}

const layoutToGridTemplate: Record<ColumnLayout, string> = {
    '1:1': '1fr 1fr',
    '1:2': '1fr 2fr',
    '2:1': '2fr 1fr',
    '1:1:1': '1fr 1fr 1fr',
    '1:2:1': '1fr 2fr 1fr',
    '2:1:1': '2fr 1fr 1fr',
    '1:1:2': '1fr 1fr 2fr'
};

const layoutToColumnCount: Record<ColumnLayout, number> = {
    '1:1': 2,
    '1:2': 2,
    '2:1': 2,
    '1:1:1': 3,
    '1:2:1': 3,
    '2:1:1': 3,
    '1:1:2': 3
};

export const ColumnNode = Node.create({
    name: 'column',

    group: 'column',

    content: 'block+',

    isolating: true,

    parseHTML() {
        return [
            { tag: 'div[data-type="column"]' }
        ];
    },

    renderHTML({ HTMLAttributes }) {
        return [
            'div',
            mergeAttributes(HTMLAttributes, {
                'data-type': 'column',
                style: 'min-width: 0;'
            }),
            0
        ];
    }
});

export const ColumnsNode = Node.create({
    name: 'columns',

    group: 'block',

    content: 'column{2,3}',

    defining: true,

    addKeyboardShortcuts() {
        return {
            'Backspace': ({ editor }) => {
                const { selection, doc } = editor.state;
                const { $from, empty: isCollapsed } = selection;

                // 빈 문단에서 커서가 맨 앞에 있을 때만 처리
                if (!isCollapsed || $from.parentOffset !== 0) return false;

                const parent = $from.parent;
                if (parent.type.name !== 'paragraph' || parent.textContent !== '') return false;
                if ($from.depth !== 1) return false;

                const $beforeParagraph = doc.resolve($from.before($from.depth));
                const index = $beforeParagraph.index();
                const docNode = $beforeParagraph.parent;

                // 인접한 형제가 columns 노드인지 확인
                const prevSibling = index > 0 ? docNode.child(index - 1) : null;
                const nextSibling = index < docNode.childCount - 1 ? docNode.child(index + 1) : null;

                if (prevSibling?.type.name === 'columns' || nextSibling?.type.name === 'columns') {
                    const from = $from.before($from.depth);
                    const to = $from.after($from.depth);
                    const { tr } = editor.state;
                    tr.delete(from, to);
                    editor.view.dispatch(tr);
                    return true;
                }

                return false;
            }
        };
    },

    addAttributes() {
        return {
            layout: {
                default: '1:1',
                parseHTML: (element) => element.getAttribute('data-layout') || '1:1'
            }
        };
    },

    parseHTML() {
        return [
            { tag: 'div[data-type="columns"]' }
        ];
    },

    renderHTML({ HTMLAttributes }) {
        const layout = (HTMLAttributes.layout || '1:1') as ColumnLayout;
        const gridTemplate = layoutToGridTemplate[layout] || '1fr 1fr';

        const style = [
            'display: grid',
            `grid-template-columns: ${gridTemplate}`,
            'gap: 16px',
            'margin: 16px 0'
        ].join('; ');

        return [
            'div',
            mergeAttributes({
                'data-type': 'columns',
                'data-layout': layout,
                style
            }),
            0
        ];
    },

    addCommands() {
        return {
            setColumns:
                (layout: ColumnLayout = '1:1') =>
                    ({ commands }) => {
                        const columnCount = layoutToColumnCount[layout];
                        const columns = Array.from({ length: columnCount }, () => ({
                            type: 'column',
                            content: [{ type: 'paragraph' }]
                        }));

                        return commands.insertContent({
                            type: this.name,
                            attrs: { layout },
                            content: columns
                        });
                    }
        };
    }
});

declare module '@tiptap/react' {
    interface Commands<ReturnType> {
        columns: {
            setColumns: (layout?: ColumnLayout) => ReturnType;
        };
    }
}
