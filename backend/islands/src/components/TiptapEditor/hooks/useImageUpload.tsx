import { useCallback } from 'react';
import type { Editor } from '@tiptap/react';
import { http } from '~/modules/http.module';
import { notification } from '@baejino/ui';

export const useImageUpload = (editor: Editor | null) => {
    const isImageFile = useCallback((file: File) => {
        const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
        return validTypes.includes(file.type);
    }, []);

    const uploadImage = useCallback(async (file: File) => {
        if (!editor) return;

        if (!isImageFile(file)) {
            notification('이미지 파일이 아닙니다.', { type: 'error' });
            return;
        }

        try {
            const formData = new FormData();
            formData.append('image', file);

            const { data } = await http('v1/image', {
                method: 'POST',
                data: formData,
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            if (data.status === 'DONE') {
                const fileSrc = data.body.url;

                if (data.body.url.includes('mp4')) {
                    // mp4는 비디오로 삽입
                    editor.chain().focus().insertContent(`<video src="${fileSrc}" controls autoplay muted loop playsinline style="max-width: 100%; height: auto;"></video>`).run();
                } else {
                    // 일반 이미지는 실제 URL로 삽입
                    editor.chain().focus().setImage({
                        src: fileSrc,
                        alt: file.name || ''
                    }).run();
                }
            } else {
                notification('이미지 업로드에 실패했습니다.', { type: 'error' });
            }
        } catch {
            notification('이미지 업로드에 실패했습니다.', { type: 'error' });
        }
    }, [editor, isImageFile]);

    const handleImageUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        await uploadImage(file);
    }, [uploadImage]);

    const handleDrop = useCallback(async (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();

        const { files } = e.dataTransfer;
        if (files.length > 1) {
            notification('하나씩 업로드 할 수 있습니다.', { type: 'error' });
            return;
        }

        const [file] = Array.from(files);
        if (!file.type.startsWith('image/')) {
            notification('이미지 파일이 아닙니다.', { type: 'error' });
            return;
        }

        await uploadImage(file);
    }, [uploadImage]);

    return {
        handleImageUpload,
        handleDrop
    };
};
