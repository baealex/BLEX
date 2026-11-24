// The server serves these at fixed paths.
const staticRoot = '/resources/';
const mediaRoot = '/resources/media/';

export const getStaticPath = (resource: string) => {
    if (resource.startsWith(staticRoot)) return resource;
    return staticRoot + resource;
};

export const getMediaPath = (resource: string) => {
    if (resource.startsWith(mediaRoot)) return resource;
    return mediaRoot + resource;
};

export const userResource = (assets?: string) => {
    if (!assets) return getStaticPath('assets/images/ghost.jpg');
    return getMediaPath(assets);
};
