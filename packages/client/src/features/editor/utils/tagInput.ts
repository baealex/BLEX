/** Spaces become hyphens, and a hyphen the author typed stays part of the tag. */
export const normalizeTagInput = (value: string) => value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9가-힣\s-]/g, '')
    .replace(/[\s-]+/g, '-')
    .replace(/^-|-$/g, '');
