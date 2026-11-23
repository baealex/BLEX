/** The non-executing JSON script that carries a post's client data. */
export const postPageDataId = 'blex-post-page-data';

/**
 * Sanitized post HTML may set `id` but can never produce a script element,
 * so this finds the server's data even when post content reuses the id.
 */
export const postPageDataSelector = `body > script[type="application/json"]#${postPageDataId}`;

/** The post body inside the server document. The child chain keeps banners and comments from standing in for it. */
export const postBodySelector = '.post-detail-main > article > [itemprop="articleBody"]';
