import { useCallback } from 'react';
import type { Editor } from '@tiptap/react';
import { notification } from '@baejino/ui';
import { uploadImage as uploadImageAPI } from '~/lib/api/posts';

export const useImageUpload = (editor: Editor | null) => {
    const isImageFile = useCallback((file: File) => {
        const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
        return validTypes.includes(file.type);
    }, []);

    const uploadImage = useCallback(async (file: File, position?: number) => {
        if (!editor) return;

        if (!isImageFile(file)) {
            notification('이미지 파일이 아닙니다.', { type: 'error' });
            return;
        }

        try {
            const { data } = await uploadImageAPI(file);

            if (data.status === 'DONE') {
                const fileSrc = data.body.url;

                // position이 지정되지 않았으면 현재 selection 사용
                const insertPos = position ?? editor.state.selection.to;

                if (data.body.url.includes('mp4')) {
                    // mp4는 비디오로 삽입
                    editor.chain()
                        .insertContentAt(insertPos, `<video src="${fileSrc}" controls autoplay muted loop playsinline style="max-width: 100%; height: auto;"></video><p></p>`)
                        .focus()
                        .run();
                } else {
                    // 일반 이미지는 실제 URL로 삽입
                    editor.chain()
                        .insertContentAt(insertPos, [
                            {
                                type: 'image',
                                attrs: {
                                    src: fileSrc,
                                    alt: file.name || '',
                                    align: 'center',
                                    objectFit: 'cover'
                                }
                            },
                            { type: 'paragraph' }
                        ])
                        .focus()
                        .run();
                }

                // 삽입 후 새로운 위치 반환 (다음 이미지를 위해)
                return editor.state.doc.content.size;
            } else {
                notification('이미지 업로드에 실패했습니다.', { type: 'error' });
            }
        } catch {
            notification('이미지 업로드에 실패했습니다.', { type: 'error' });
        }
    }, [editor, isImageFile]);

    const handlePaste = useCallback(async (event: ClipboardEvent) => {
        if (!editor) return;

        const items = event.clipboardData?.items;
        if (!items) return;

        const imageFiles: File[] = [];
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (item.type.startsWith('image/')) {
                const file = item.getAsFile();
                if (file) {
                    imageFiles.push(file);
                }
            }
        }

        if (imageFiles.length > 0) {
            event.preventDefault();
            for (const file of imageFiles) {
                await uploadImage(file);
            }
        }
    }, [editor, uploadImage]);

    const handleImageUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (!files || files.length === 0) return;

        for (let i = 0; i < files.length; i++) {
            await uploadImage(files[i]);
        }
    }, [uploadImage]);

    const handleDrop = useCallback(async (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();

        const { files } = e.dataTransfer;
        if (files.length === 0) return;

        const imageFiles = Array.from(files).filter(file => file.type.startsWith('image/'));

        if (imageFiles.length === 0) {
            notification('이미지 파일이 아닙니다.', { type: 'error' });
            return;
        }

        for (const file of imageFiles) {
            await uploadImage(file);
        }
    }, [uploadImage]);

    return {
        handleImageUpload,
        handleDrop,
        handlePaste
    };
};
