export const userResource = (assets?: string) => {
    if (!assets) return '/resources/media/images/ghost.jpg';
    return assets;
};

export const getStaticPath = (resource: string) => {
    if (resource.startsWith(window.configuration.static)) return resource;
    return window.configuration.static + resource;
};
