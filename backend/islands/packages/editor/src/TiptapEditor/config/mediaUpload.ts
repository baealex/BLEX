export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif'] as const;
export const ACCEPTED_VIDEO_TYPES = ['video/mp4', 'video/webm'] as const;
export const ACCEPTED_IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif'] as const;
export const ACCEPTED_VIDEO_EXTENSIONS = ['mp4', 'webm'] as const;

export const ACCEPTED_IMAGE_INPUT_TYPES = [
    ...ACCEPTED_IMAGE_TYPES,
    ...ACCEPTED_IMAGE_EXTENSIONS.map(extension => `.${extension}`)
].join(',');

export const ACCEPTED_VIDEO_INPUT_TYPES = [
    ...ACCEPTED_VIDEO_TYPES,
    ...ACCEPTED_VIDEO_EXTENSIONS.map(extension => `.${extension}`)
].join(',');

type TextDataTransfer = Pick<DataTransfer, 'types' | 'getData'>;

type TextMediaDropKind = 'prosemirror' | 'external-media' | 'none';

const hasProseMirrorSliceData = (dataTransfer: TextDataTransfer) => {
    return Array.from(dataTransfer.types).includes('application/x-prosemirror-slice')
        || dataTransfer.getData('text/html').includes('data-pm-slice');
};

const hasExternalMediaContent = (dataTransfer: TextDataTransfer) => {
    const html = dataTransfer.getData('text/html');
    if (/<(?:img|video|source)\b/i.test(html)) return true;

    const uri = dataTransfer.getData('text/uri-list') || dataTransfer.getData('text/plain');
    return /\.(?:jpe?g|png|gif|webp|avif|mp4|webm)(?:[?#].*)?$/i.test(uri.trim());
};

export const classifyTextMediaDrop = (dataTransfer: TextDataTransfer): TextMediaDropKind => {
    if (hasProseMirrorSliceData(dataTransfer)) return 'prosemirror';
    if (hasExternalMediaContent(dataTransfer)) return 'external-media';
    return 'none';
};
