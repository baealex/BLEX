export const getIconClassName = (name: string) => {
    if (
        name === 'github' ||
        name === 'twitter' ||
        name === 'facebook' ||
        name === 'instagram' ||
        name === 'linkedin' ||
        name === 'youtube' ||
        name === 'telegram'
    ) {
        return `fab fa-${name}`;
    }
    return 'fab fa-edge';
};