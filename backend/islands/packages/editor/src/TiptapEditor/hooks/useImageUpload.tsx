import type { Editor } from '@tiptap/react';

interface UseImageUploadProps {
    editor: Editor | null;
    onImageUpload?: (file: File) => Promise<string | undefined>;
    onImageUploadError?: (errorMessage: string) => void;
}

export const useImageUpload = ({ editor, onImageUpload, onImageUploadError }: UseImageUploadProps) => {
    const isMediaFile = (file: File) => {
        const validImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
        const validVideoTypes = ['video/mp4', 'video/webm'];
        return validImageTypes.includes(file.type) || validVideoTypes.includes(file.type);
    };

    const isVideoFile = (file: File) => {
        const validVideoTypes = ['video/mp4', 'video/webm'];
        return validVideoTypes.includes(file.type);
    };

    const uploadMedia = async (file: File, position?: number) => {
        if (!editor || !onImageUpload) return;

        if (!isMediaFile(file)) {
            onImageUploadError?.('지원하지 않는 파일 형식입니다.');
            return;
        }

        try {
            const url = await onImageUpload(file);

            if (url) {
                // position이 지정되지 않았으면 현재 selection 사용
                const insertPos = position ?? editor.state.selection.to;

                if (isVideoFile(file) || url.includes('.mp4') || url.includes('.webm')) {
                    // 비디오는 video 노드로 삽입
                    editor.chain()
                        .insertContentAt(insertPos, [
                            {
                                type: 'video',
                                attrs: {
                                    src: url,
                                    align: 'center',
                                    playMode: 'gif', // 기본값: 움짤 모드
                                    aspectRatio: null,
                                    objectFit: 'cover'
                                }
                            },
                            { type: 'paragraph' }
                        ])
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

                // 삽입 후 새로운 위치 반환 (다음 파일을 위해)
                return editor.state.doc.content.size;
            } else {
                onImageUploadError?.('파일 업로드에 실패했습니다.');
            }
        } catch {
            onImageUploadError?.('파일 업로드에 실패했습니다.');
        }
    };

    const handlePaste = async (event: ClipboardEvent) => {
        if (!editor) return;

        const items = event.clipboardData?.items;
        if (!items) return;

        const mediaFiles: File[] = [];
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (item.type.startsWith('image/') || item.type.startsWith('video/')) {
                const file = item.getAsFile();
                if (file) {
                    mediaFiles.push(file);
                }
            }
        }

        if (mediaFiles.length > 0) {
            event.preventDefault();
            for (const file of mediaFiles) {
                await uploadMedia(file);
            }
        }
    };

    const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (!files || files.length === 0) return;

        for (let i = 0; i < files.length; i++) {
            await uploadMedia(files[i]);
        }
    };

    const handleVideoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (!files || files.length === 0) return;

        for (let i = 0; i < files.length; i++) {
            await uploadMedia(files[i]);
        }
    };

    const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();

        const { files } = e.dataTransfer;
        if (files.length === 0) return;

        const mediaFiles = Array.from(files).filter(
            file => file.type.startsWith('image/') || file.type.startsWith('video/')
        );

        if (mediaFiles.length === 0) {
            onImageUploadError?.('지원하지 않는 파일 형식입니다.');
            return;
        }

        for (const file of mediaFiles) {
            await uploadMedia(file);
        }
    };

    return {
        handleImageUpload,
        handleVideoUpload,
        handleDrop,
        handlePaste
    };
};
