import { SiteHeader, type SiteHeaderProps } from '../appearance/shell.js';

export interface ApplicationView {
  header: SiteHeaderProps | null;
  html: string;
}

export function ApplicationFrame({ view }: { view: ApplicationView }) {
  return <>
    {view.header && <SiteHeader {...view.header} />}
    <div id="blex-route-content" className="contents" dangerouslySetInnerHTML={{ __html: view.html }} />
  </>;
}
