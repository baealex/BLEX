import 'react';
import 'react/jsx-runtime';
import 'react-dom/server';
import type { PageProps } from '../../../client/src/contracts/pages.js';

export type { HeaderViewer, LoginModel, SiteHeaderProps } from '../../../client/src/contracts/views.js';

// The client package owns every view. The server loads its build and hands each route its data.
const client = await import(new URL('../../ssr/entry-server.js', import.meta.url).href) as {
  renderPage(id: string, props: unknown): string;
};

export function renderPage<Id extends keyof PageProps>(id: Id, props: PageProps[Id]): string {
  return client.renderPage(id, props);
}
