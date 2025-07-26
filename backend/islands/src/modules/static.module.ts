export const userResource = (assets?: string) => {
    if (!assets) return '/assets/images/ghost.jpg';
    return assets;
};

export const getStaticPath = (resource: string) => {
    return window.configuration.static + resource;
};
