import { useCallback } from 'react';
import type { Editor } from '@tiptap/react';

interface UseImageUploadProps {
    editor: Editor | null;
    onImageUpload?: (file: File) => Promise<string | undefined>;
    onImageUploadError?: (errorMessage: string) => void;
}

export const useImageUpload = ({ editor, onImageUpload, onImageUploadError }: UseImageUploadProps) => {
    const isImageFile = useCallback((file: File) => {
        const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
        return validTypes.includes(file.type);
    }, []);

    const uploadImage = useCallback(async (file: File, position?: number) => {
        if (!editor || !onImageUpload) return;

        if (!isImageFile(file)) {
            onImageUploadError?.('이미지 파일이 아닙니다.');
            return;
        }

        try {
            const url = await onImageUpload(file);

            if (url) {
                // position이 지정되지 않았으면 현재 selection 사용
                const insertPos = position ?? editor.state.selection.to;

                if (url.includes('mp4')) {
                    // mp4는 비디오로 삽입
                    editor.chain()
                        .insertContentAt(insertPos, `<video src="${url}" controls autoplay muted loop playsinline style="max-width: 100%; height: auto;"></video><p></p>`)
                        .focus()
                        .run();
                } else {
                    // 일반 이미지는 실제 URL로 삽입
                    editor.chain()
                        .insertContentAt(insertPos, [
                            {
                                type: 'image',
                                attrs: {
                                    src: url,
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
                onImageUploadError?.('이미지 업로드에 실패했습니다.');
            }
        } catch {
            onImageUploadError?.('이미지 업로드에 실패했습니다.');
        }
    }, [editor, isImageFile, onImageUpload]);

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
            onImageUploadError?.('이미지 파일이 아닙니다.');
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
