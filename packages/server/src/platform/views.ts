import 'react';
import 'react/jsx-runtime';
import 'react-dom/server';
import type { PageProps } from '../../../client/src/contracts/pages.js';
import type { ClientViews } from '../../../client/src/contracts/views.js';

export type { HeaderViewer, LoginModel, SiteHeaderProps, SiteIconName } from '../../../client/src/contracts/views.js';

// The client package owns every view. This loads its server-rendering build beside the compiled server.
const views = await import(new URL('../../ssr/entry-server.js', import.meta.url).href) as ClientViews;

export const {
  renderApplicationDocument, SiteHeader, SiteFooter, SiteTheme, SiteIcon, loginPromptProps,
  AuthorHeader, PostComments, ReaderActions, LoginForm, AuthPanel, authField, authInput, authSubmit,
  opensOutsideApplication, commentModel,
} = views;

export function renderPage<Id extends keyof PageProps>(id: Id, props: PageProps[Id]): string {
  return views.renderPage(id, props);
}
