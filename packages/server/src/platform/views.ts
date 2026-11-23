import 'react';
import 'react/jsx-runtime';
import 'react-dom/server';
import type { ClientViews } from '../../../client/src/contracts/views.js';

export type { HeaderViewer, LoginModel, SiteHeaderProps, SiteIconName } from '../../../client/src/contracts/views.js';

// The client package owns every view. This loads its server-rendering build beside the compiled server.
const views = await import(new URL('../../ssr/entry-server.js', import.meta.url).href) as ClientViews;

export const {
  renderApplicationDocument, SiteHeader, SiteFooter, SiteTheme, SiteIcon, loginPromptProps,
  AuthorHeader, PostComments, ReaderActions, LoginForm, AuthPanel, authField, authInput, authSubmit,
  opensOutsideApplication, commentModel,
} = views;
