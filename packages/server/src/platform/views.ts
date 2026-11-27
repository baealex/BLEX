import 'react';
import 'react/jsx-runtime';
import 'react-dom/server';
import type { PageProps } from '@blex/contracts/pages';
import { requestLocale } from './request-locale.js';
import { requestReturnPath } from './request-path.js';
import { readSiteStylesheets } from './ui-assets.js';

export type { HeaderViewer, LoginModel, SiteHeaderProps } from '@blex/contracts/views';

// The client package owns every view. The server loads its build and hands each route its data.
const client = (await import(new URL('../../ssr/entry-server.js', import.meta.url).href)) as {
  renderPage(id: string, props: unknown, locale: string, returnPath?: string): string;
  setSiteStylesheets(hrefs: { theme: string; fonts: string }): void;
};
client.setSiteStylesheets(await readSiteStylesheets());

export function renderPage<Id extends keyof PageProps>(id: Id, props: PageProps[Id]): string {
  return client.renderPage(id, props, requestLocale(), requestReturnPath());
}
