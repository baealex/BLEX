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
