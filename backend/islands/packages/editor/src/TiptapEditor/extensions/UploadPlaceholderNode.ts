import { Node } from '@tiptap/react';
import { formatEditorMessage } from '../i18n';

export interface UploadPlaceholderMessages {
    imageLabel: string;
    videoLabel: string;
    progressTemplate: string;
}

export const UploadPlaceholderNode = Node.create<UploadPlaceholderMessages>({
    name: 'uploadPlaceholder',

    group: 'block',

    atom: true,

    selectable: false,

    draggable: false,

    addOptions() {
        return {
            imageLabel: 'Image',
            videoLabel: 'Video',
            progressTemplate: 'Uploading {mediaType}...{fileName}'
        };
    },

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
        const mediaType = HTMLAttributes.mediaType === 'video'
            ? this.options.videoLabel
            : this.options.imageLabel;
        const fileName = HTMLAttributes.fileName ? ` · ${HTMLAttributes.fileName}` : '';
        const progressLabel = formatEditorMessage(this.options.progressTemplate, {
            mediaType,
            fileName
        });

        return [
            'div',
            {
                'data-upload-placeholder': 'true',
                'data-upload-id': HTMLAttributes.id || '',
                class: 'media-upload-placeholder'
            },
            ['span', { class: 'media-upload-placeholder__spinner' }],
            ['span', { class: 'media-upload-placeholder__text' }, progressLabel]
        ];
    }
});
