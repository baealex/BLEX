// Tests reach into the client's server-rendering build for the few views they assert on directly.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const views: any = await import(new URL('../../ssr/entry-server.js', import.meta.url).href);

export const { renderApplicationDocument, opensOutsideApplication, SiteHeader, SiteTheme, ReaderActions, commentModel } = views;
