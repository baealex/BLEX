import { useState } from 'react';
import type { Editor } from '@tiptap/react';
import { Fragment, Slice } from '@tiptap/pm/model';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import type { Transaction } from '@tiptap/pm/state';
import { dropPoint } from '@tiptap/pm/transform';
import {
    ACCEPTED_IMAGE_EXTENSIONS,
    ACCEPTED_IMAGE_TYPES,
    ACCEPTED_VIDEO_EXTENSIONS,
    ACCEPTED_VIDEO_TYPES
} from '../config/mediaUpload';

interface UseImageUploadProps {
    editor: Editor | null;
    onImageUpload?: (file: File) => Promise<string | undefined>;
    onImageUploadError?: (errorMessage: string) => void;
}

interface TransactionEvent {
    transaction: Transaction;
}

interface DropOptions {
    invalidPositionMessage?: string;
}

interface UploadSlot {
    file: File;
    placeholderId: string;
    positionTracker: ReturnType<typeof createPositionTracker>;
    placeholderTracker: ReturnType<typeof createPositionTracker>;
}

interface ActivePlaceholder {
    position: number;
    node: ProseMirrorNode;
}

const createPositionTracker = (
    editor: Editor,
    position: number,
    clampPosition: (position: number) => number,
    assoc = 1
) => {
    let currentPosition = clampPosition(position);
    const handleTransaction = ({ transaction }: TransactionEvent) => {
        currentPosition = clampPosition(transaction.mapping.map(currentPosition, assoc));
    };

    editor.on('transaction', handleTransaction);

    return {
        getPosition: () => clampPosition(currentPosition),
        stop: () => {
            editor.off('transaction', handleTransaction);
        }
    };
};

export const useImageUpload = ({ editor, onImageUpload, onImageUploadError }: UseImageUploadProps) => {
    const [uploadingCount, setUploadingCount] = useState(0);

    const getFileExtension = (file: File) => {
        return file.name.split('.').pop()?.toLowerCase() ?? '';
    };

    const isMediaFile = (file: File) => {
        const extension = getFileExtension(file);
        return ACCEPTED_IMAGE_TYPES.includes(file.type as typeof ACCEPTED_IMAGE_TYPES[number])
            || ACCEPTED_VIDEO_TYPES.includes(file.type as typeof ACCEPTED_VIDEO_TYPES[number])
            || ACCEPTED_IMAGE_EXTENSIONS.includes(extension as typeof ACCEPTED_IMAGE_EXTENSIONS[number])
            || ACCEPTED_VIDEO_EXTENSIONS.includes(extension as typeof ACCEPTED_VIDEO_EXTENSIONS[number]);
    };

    const isVideoFile = (file: File) => {
        return ACCEPTED_VIDEO_TYPES.includes(file.type as typeof ACCEPTED_VIDEO_TYPES[number])
            || ACCEPTED_VIDEO_EXTENSIONS.includes(getFileExtension(file) as typeof ACCEPTED_VIDEO_EXTENSIONS[number]);
    };

    const getSupportedFileMessage = () => '지원하는 파일은 JPG, PNG, GIF, MP4, WebM입니다.';

    const clampPosition = (position: number) => {
        if (!editor) return position;
        return Math.max(0, Math.min(position, editor.state.doc.content.size));
    };

    const trackPosition = (position: number, assoc = 1) => {
        if (!editor) {
            return {
                getPosition: () => position,
                stop: () => {}
            };
        }

        return createPositionTracker(editor, position, clampPosition, assoc);
    };

    const getMediaType = (file: File) => {
        return isVideoFile(file) ? 'video' : 'image';
    };

    const makeUploadId = () => {
        return `upload-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    };

    const createUploadPlaceholder = (file: File) => {
        if (!editor?.schema.nodes.uploadPlaceholder) return null;

        return editor.schema.nodes.uploadPlaceholder.create({
            id: makeUploadId(),
            fileName: file.name,
            mediaType: getMediaType(file)
        });
    };

    const getDropPositionForNode = (node: NonNullable<ReturnType<typeof createUploadPlaceholder>>, position: number) => {
        if (!editor) return null;

        const insertPosition = dropPoint(
            editor.state.doc,
            clampPosition(position),
            new Slice(Fragment.from(node), 0, 0)
        );

        return insertPosition ?? null;
    };

    const insertUploadPlaceholder = (
        node: NonNullable<ReturnType<typeof createUploadPlaceholder>>,
        position: number
    ) => {
        if (!editor) return false;

        const insertPosition = clampPosition(position);
        const transaction = editor.state.tr.insert(insertPosition, node).setMeta('addToHistory', false);

        try {
            editor.view.dispatch(transaction);
            return true;
        } catch {
            return false;
        }
    };

    const deleteUploadPlaceholder = (position: number) => {
        if (!editor) return false;

        const deletePosition = clampPosition(position);
        const node = editor.state.doc.nodeAt(deletePosition);

        if (node?.type.name !== 'uploadPlaceholder') {
            return false;
        }

        editor.view.dispatch(
            editor.state.tr
                .delete(deletePosition, deletePosition + node.nodeSize)
                .setMeta('addToHistory', false)
        );
        return true;
    };

    const getNextPosition = (insertPosition: number, type: 'image' | 'video', attrs: Record<string, unknown>) => {
        if (!editor) return insertPosition;

        const mediaNode = editor.schema.nodes[type]?.create(attrs);
        const paragraphNode = editor.schema.nodes.paragraph?.create();

        if (!mediaNode || !paragraphNode) {
            return insertPosition;
        }

        return clampPosition(insertPosition + mediaNode.nodeSize + paragraphNode.nodeSize);
    };

    const insertUploadedMedia = (file: File, url: string, position: number, replaceTo?: number) => {
        if (!editor) return position;

        const insertPosition = clampPosition(position);
        const target = typeof replaceTo === 'number'
            ? {
                from: insertPosition,
                to: clampPosition(replaceTo)
            }
            : insertPosition;

        if (isVideoFile(file) || url.includes('.mp4') || url.includes('.webm')) {
            const attrs = {
                src: url,
                align: 'center',
                playMode: 'gif',
                aspectRatio: null,
                objectFit: 'cover'
            };

            editor.chain()
                .focus()
                .insertContentAt(target, [
                    {
                        type: 'video',
                        attrs
                    },
                    { type: 'paragraph' }
                ])
                .run();

            return getNextPosition(insertPosition, 'video', attrs);
        }

        const attrs = {
            src: url,
            alt: file.name || '',
            align: 'center',
            objectFit: 'cover'
        };

        editor.chain()
            .focus()
            .insertContentAt(target, [
                {
                    type: 'image',
                    attrs
                },
                { type: 'paragraph' }
            ])
            .run();

        return getNextPosition(insertPosition, 'image', attrs);
    };

    const prepareUploadSlot = (file: File, position: number): UploadSlot | null => {
        if (!editor) return null;
        if (!isMediaFile(file)) {
            onImageUploadError?.(getSupportedFileMessage());
            return null;
        }

        const placeholderNode = createUploadPlaceholder(file);
        if (!placeholderNode) {
            onImageUploadError?.('파일 업로드 위치를 만들 수 없습니다.');
            return null;
        }

        const insertPosition = getDropPositionForNode(placeholderNode, position);
        if (insertPosition === null) {
            onImageUploadError?.('이 위치에는 파일을 넣을 수 없습니다.');
            return null;
        }

        const positionTracker = trackPosition(insertPosition);
        const placeholderTracker = trackPosition(insertPosition, -1);
        const isPlaceholderInserted = insertUploadPlaceholder(placeholderNode, insertPosition);

        if (!isPlaceholderInserted) {
            positionTracker.stop();
            placeholderTracker.stop();
            onImageUploadError?.('파일 업로드 위치를 만들 수 없습니다.');
            return null;
        }

        return {
            file,
            placeholderId: String(placeholderNode.attrs.id ?? ''),
            positionTracker,
            placeholderTracker
        };
    };

    const getActivePlaceholder = (slot: UploadSlot): ActivePlaceholder | null => {
        if (!editor) return null;

        const position = slot.placeholderTracker.getPosition();
        const node = editor.state.doc.nodeAt(position);
        if (
            node?.type.name === 'uploadPlaceholder'
            && node.attrs.id === slot.placeholderId
        ) {
            return {
                position,
                node
            };
        }

        let foundPlaceholder: ActivePlaceholder | null = null;
        editor.state.doc.descendants((descendant, descendantPosition) => {
            if (foundPlaceholder) return false;
            if (
                descendant.type.name === 'uploadPlaceholder'
                && descendant.attrs.id === slot.placeholderId
            ) {
                foundPlaceholder = {
                    position: descendantPosition,
                    node: descendant
                };
                return false;
            }
            return true;
        });

        return foundPlaceholder;
    };

    const deleteActivePlaceholder = (slot: UploadSlot) => {
        const activePlaceholder = getActivePlaceholder(slot);
        if (!activePlaceholder) return false;
        return deleteUploadPlaceholder(activePlaceholder.position);
    };

    const uploadPreparedMedia = async (slot: UploadSlot) => {
        if (!editor || !onImageUpload) return;

        try {
            if (!getActivePlaceholder(slot)) {
                return slot.positionTracker.getPosition();
            }

            const url = await onImageUpload(slot.file);

            if (url) {
                const activePlaceholder = getActivePlaceholder(slot);
                if (!activePlaceholder) {
                    return slot.positionTracker.getPosition();
                }

                const replaceTo = activePlaceholder.position + activePlaceholder.node.nodeSize;
                const nextPosition = insertUploadedMedia(slot.file, url, activePlaceholder.position, replaceTo);
                return nextPosition;
            } else {
                deleteActivePlaceholder(slot);
                onImageUploadError?.('파일 업로드에 실패했습니다.');
            }
        } catch (error) {
            deleteActivePlaceholder(slot);
            onImageUploadError?.(error instanceof Error ? error.message : '파일 업로드에 실패했습니다.');
        } finally {
            slot.positionTracker.stop();
            slot.placeholderTracker.stop();
            setUploadingCount(prev => Math.max(0, prev - 1));
        }
    };

    const uploadMediaFiles = async (files: File[], position: number) => {
        if (!editor || !onImageUpload) return;

        let nextPosition = position;
        const uploadSlots: UploadSlot[] = [];

        for (const file of files) {
            const slot = prepareUploadSlot(file, nextPosition);
            if (!slot) continue;

            uploadSlots.push(slot);
            nextPosition = slot.positionTracker.getPosition();
        }

        if (uploadSlots.length === 0) return;

        setUploadingCount(prev => prev + uploadSlots.length);

        for (const slot of uploadSlots) {
            await uploadPreparedMedia(slot);
        }
    };

    const getMediaFiles = (fileList: FileList | File[]) => {
        const files = Array.from(fileList);
        return {
            mediaFiles: files.filter(isMediaFile),
            rejectedFiles: files.filter(file => !isMediaFile(file))
        };
    };

    const hasExternalMediaContent = (dataTransfer: DataTransfer) => {
        const html = dataTransfer.getData('text/html');
        if (/<(?:img|video|source)\b/i.test(html)) return true;

        const uri = dataTransfer.getData('text/uri-list') || dataTransfer.getData('text/plain');
        return /\.(?:jpe?g|png|gif|webp|avif|mp4|webm)(?:[?#].*)?$/i.test(uri.trim());
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
            await uploadMediaFiles(mediaFiles, editor.state.selection.to);
        }
    };

    const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (!files || files.length === 0) return;

        const { mediaFiles, rejectedFiles } = getMediaFiles(files);
        if (rejectedFiles.length > 0) {
            onImageUploadError?.(getSupportedFileMessage());
        }

        await uploadMediaFiles(mediaFiles, editor?.state.selection.to ?? 0);
        event.target.value = '';
    };

    const handleVideoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (!files || files.length === 0) return;

        const { mediaFiles, rejectedFiles } = getMediaFiles(files);
        if (rejectedFiles.length > 0) {
            onImageUploadError?.(getSupportedFileMessage());
        }

        await uploadMediaFiles(mediaFiles, editor?.state.selection.to ?? 0);
        event.target.value = '';
    };

    const handleDrop = (event: DragEvent, position?: number, options?: DropOptions) => {
        if (!editor) return false;

        const dataTransfer = event.dataTransfer;
        if (!dataTransfer) return false;

        const { mediaFiles, rejectedFiles } = getMediaFiles(dataTransfer.files);
        const hasExternalMedia = hasExternalMediaContent(dataTransfer);
        const hasHandledMediaPayload = mediaFiles.length > 0 || rejectedFiles.length > 0 || hasExternalMedia;

        if (options?.invalidPositionMessage && hasHandledMediaPayload) {
            event.preventDefault();
            event.stopPropagation();
            onImageUploadError?.(options.invalidPositionMessage);
            return true;
        }

        if (mediaFiles.length === 0) {
            if (rejectedFiles.length > 0) {
                event.preventDefault();
                event.stopPropagation();
                onImageUploadError?.(getSupportedFileMessage());
                return true;
            }

            if (hasExternalMedia) {
                event.preventDefault();
                event.stopPropagation();
                onImageUploadError?.('이미지나 비디오는 파일로 내려놓아 주세요.');
                return true;
            }

            return false;
        }

        event.preventDefault();
        event.stopPropagation();

        if (rejectedFiles.length > 0) {
            onImageUploadError?.(getSupportedFileMessage());
        }

        void uploadMediaFiles(mediaFiles, position ?? editor.state.selection.to);
        return true;
    };

    return {
        handleImageUpload,
        handleVideoUpload,
        handleDrop,
        handlePaste,
        isUploading: uploadingCount > 0,
        uploadingCount
    };
};
