import { Node } from '@tiptap/react';

export const UploadPlaceholderNode = Node.create({
    name: 'uploadPlaceholder',

    group: 'block',

    atom: true,

    selectable: false,

    draggable: false,

    addAttributes() {
        return {
            id: { default: null },
            fileName: { default: null },
            mediaType: { default: 'file' }
        };
    },

    parseHTML() {
        return [
            { tag: 'div[data-upload-placeholder]' }
        ];
    },

    renderHTML({ HTMLAttributes }) {
        const mediaType = HTMLAttributes.mediaType === 'video' ? '비디오' : '이미지';
        const fileName = HTMLAttributes.fileName ? ` · ${HTMLAttributes.fileName}` : '';

        return [
            'div',
            {
                'data-upload-placeholder': 'true',
                'data-upload-id': HTMLAttributes.id || '',
                class: 'media-upload-placeholder'
            },
            ['span', { class: 'media-upload-placeholder__spinner' }],
            ['span', { class: 'media-upload-placeholder__text' }, `${mediaType} 업로드 중...${fileName}`]
        ];
    }
});
