/** The non-executing JSON scripts that carry a page's client data. */
export const postPageDataId = 'blex-post-page-data';
export const discoveryPageDataId = 'blex-discovery-page-data';

/**
 * Sanitized authored HTML may set `id` but can never produce a direct child script of `<body>`,
 * so this finds the server's data even when authored content reuses the id.
 */
const pageDataSelector = (id: string) => `body > script[type="application/json"]#${id}`;

export const postPageDataSelector = pageDataSelector(postPageDataId);
export const discoveryPageDataSelector = pageDataSelector(discoveryPageDataId);
export const authorPageDataId = 'blex-author-page-data';
export const authorPageDataSelector = pageDataSelector(authorPageDataId);

/** The post body inside the server document. The child chain keeps banners and comments from standing in for it. */
export const postBodySelector = '.post-detail-main > article > [itemprop="articleBody"]';
