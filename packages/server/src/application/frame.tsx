import { SiteHeader, type SiteHeaderProps } from '../appearance/shell.js';

export interface ApplicationView {
  header: SiteHeaderProps | null;
  html: string;
  /** Starts a fresh screen even when two URLs share the same server markup. */
  contentKey?: string;
}

export function ApplicationFrame({ view }: { view: ApplicationView }) {
  return <>
    {view.header && <SiteHeader {...view.header} />}
    <div key={view.contentKey} id="blex-route-content" className="contents" dangerouslySetInnerHTML={{ __html: view.html }} />
  </>;
}
