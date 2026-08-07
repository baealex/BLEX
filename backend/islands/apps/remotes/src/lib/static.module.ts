export const getStaticPath = (resource: string) => {
    if (resource.startsWith(window.configuration.static)) return resource;
    return window.configuration.static + resource;
};

export const getMediaPath = (resource: string) => {
    if (resource.startsWith(window.configuration.media)) return resource;
    return window.configuration.media + resource;
};

export const userResource = (assets?: string) => {
    if (!assets) return getStaticPath('assets/images/ghost.jpg');
    return getMediaPath(assets);
};
