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
/** The work log list, a log, its delete pages, and shared logs. */
export const workLogPageDataId = 'blex-work-log-page-data';
export const workLogPageDataSelector = pageDataSelector(workLogPageDataId);
/** Static, error, and developer guide pages, which carry little data of their own. */
export const contentPageDataId = 'blex-content-page-data';
export const contentPageDataSelector = pageDataSelector(contentPageDataId);
export const loginPageDataId = 'blex-login-page-data';
export const loginPageDataSelector = pageDataSelector(loginPageDataId);
/** Sign-up, first administrator setup, identity check, and password reset forms. */
export const authFormPageDataId = 'blex-auth-form-page-data';
export const authFormPageDataSelector = pageDataSelector(authFormPageDataId);
/** A post author's revision history, writing timeline, and share links. */
export const postManagementPageDataId = 'blex-post-management-page-data';
export const postManagementPageDataSelector = pageDataSelector(postManagementPageDataId);

/** Settings, admin settings, search, sign-up, and the post editor, which render on the client. */
export const screenPageDataId = 'blex-screen-page-data';
export const screenPageDataSelector = pageDataSelector(screenPageDataId);

/** The post body inside the server document. The child chain keeps banners and comments from standing in for it. */
export const postBodySelector = '.post-detail-main > article > [itemprop="articleBody"]';
