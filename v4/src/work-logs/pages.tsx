import { renderApplicationDocument } from '../application/document.js';
import { SiteFooter, SiteHeader, SiteTheme, type HeaderViewer } from '../appearance/shell.js';

export interface WorkLogView {
  id: number;
  title: string;
  createdAt: string;
  entryCount?: number;
}

export interface WorkLogEntryView {
  id: number;
  title: string;
  text: string;
  mediaType: string;
  attachment: string;
  createdAt: string;
}

export interface WorkLogShareView {
  id: number;
  token: string;
  headline: string;
  createdAt: string;
}

interface PagerView {
  previous?: string;
  next?: string;
  anchor?: string;
}

interface PageOptions {
  title: string;
  robots?: boolean;
  viewer?: HeaderViewer;
  className?: string;
  shareMeta?: {
    title: string;
    description: string;
    url: string;
    imageUrl?: string;
  };
}

function shell(options: PageOptions, content: React.ReactNode): string {
  return renderApplicationDocument(<html lang="ko">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="referrer" content="strict-origin" />
        <meta name="robots" content={options.robots === false ? 'index,follow' : 'noindex,nofollow,noarchive'} />
        <meta name="color-scheme" content="light dark" />
        <title>{options.title}</title>
        <SiteTheme />
        {options.shareMeta && <>
          <meta property="og:type" content="article" />
          <meta property="og:title" content={options.shareMeta.title} />
          <meta property="og:description" content={options.shareMeta.description} />
          <meta property="og:url" content={options.shareMeta.url} />
          <meta name="twitter:card" content={options.shareMeta.imageUrl ? 'summary_large_image' : 'summary'} />
          {options.shareMeta.imageUrl && <meta property="og:image" content={options.shareMeta.imageUrl} />}
        </>}
        <style>{`
          .work-log-page h1 { font-size: clamp(2.25rem, 4vw, 3rem); font-weight: 700; line-height: 1.15; letter-spacing: -.025em; }
          .work-log-page h2 { font-size: 1.25rem; font-weight: 600; }
          .work-log-page h3 { font-weight: 600; }
          .work-log-page form:not([data-site-logout]) > p:not([class]) { margin-block: .6rem; }
          .work-log-page label > input:not([type=checkbox]), .work-log-page textarea { display: block; width: 100%; border: 1px solid var(--color-line); border-radius: .5rem; padding: .65rem .75rem; }
          .work-log-page button, .work-log-page .button { display: inline-flex; min-height: 2.75rem; align-items: center; padding-inline: .85rem; border: 1px solid var(--color-line); border-radius: .5rem; font-size: .875rem; font-weight: 600; cursor: pointer; }
          .work-log-page button:hover, .work-log-page .button:hover { background: var(--color-surface-subtle); }
          .work-log-page button.work-log-primary { background: var(--color-action); color: var(--color-content-inverted); }
          .work-log-page button.work-log-primary:hover { background: var(--color-action-hover); }
          .work-log-page nav { display: flex; flex-wrap: wrap; gap: .5rem; margin-top: 1rem; }
          .work-log-page img, .work-log-page video { max-height: 34rem; object-fit: contain; }
          .work-log-page .muted { color: var(--color-content-secondary); }
          .work-log-page .error { color: var(--color-danger); }
        `}</style>
      </head>
      <body className="bg-surface-page text-content antialiased"><SiteHeader viewer={options.viewer} />
        <main className={`work-log-page mx-auto min-h-[calc(100vh-10.5rem)] px-5 py-12 sm:px-8 sm:py-16 ${options.className ?? 'max-w-5xl'}`}>{content}</main>
        <SiteFooter />
      </body>
    </html>);
}

function csrfInput(value: string) {
  return <input type="hidden" name="csrfmiddlewaretoken" value={value} />;
}

function pager(pagerView: PagerView, label: string) {
  if (!pagerView.previous && !pagerView.next) return null;
  return <nav aria-label={label}>
    {pagerView.previous && <a className="button" href={`${pagerView.previous}${pagerView.anchor ? `#${pagerView.anchor}` : ''}`}>Previous</a>}
    {pagerView.next && <a className="button" href={`${pagerView.next}${pagerView.anchor ? `#${pagerView.anchor}` : ''}`}>Next</a>}
  </nav>;
}

export function renderWorkLogIndex(props: {
  logs: WorkLogView[];
  canWrite: boolean;
  csrfToken: string;
  viewer?: HeaderViewer;
  error?: string;
  links: PagerView;
}): string {
  return shell({ title: '작업 일지 · BLEX', className: 'max-w-3xl', viewer: props.viewer }, <>
    <h1>작업 일지</h1>
    {props.canWrite && <form method="post" action="/work-logs/" className="mt-8 rounded-2xl border border-line bg-surface p-5 sm:p-6">
      {csrfInput(props.csrfToken)}
      <label htmlFor="work-log-title" className="text-sm font-semibold">새 작업 일지</label>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row"><input id="work-log-title" name="title" required maxLength={100}
        placeholder="어떤 작업을 하고 있나요?" className="min-h-12 min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 placeholder:text-content-hint" />
        <button className="work-log-primary min-h-12">작업 일지 만들기</button></div>
      {props.error && <p className="error mt-2 text-sm" role="alert">{props.error}</p>}
    </form>}
    {props.logs.length > 0 ? <ul className="mt-8 divide-y divide-line border-y border-line">
      {props.logs.map((log) => <li key={log.id}>
        <a href={`/work-logs/${log.id}/`} className="group flex min-h-16 items-center justify-between gap-3 py-4 transition hover:text-content-secondary">
          <span><span className="block break-words font-semibold">{log.title}</span><span className="mt-1 block text-sm text-content-secondary">기록 {log.entryCount ?? 0}개</span></span>
          <span aria-hidden="true" className="text-xs text-content-hint transition group-hover:translate-x-1">→</span>
        </a>
      </li>)}
    </ul> : <p className="mt-6 text-sm text-content-secondary">아직 작업 일지가 없습니다.</p>}
    {pager(props.links, '작업 일지 페이지')}
  </>);
}

function mediaElement(entry: WorkLogEntryView, url: string, lazy = false) {
  const label = entry.title || 'Work log attachment';
  return entry.mediaType.startsWith('video/')
    ? <video src={url} controls playsInline preload="metadata" aria-label={label} />
    : <img src={url} alt={label} loading={lazy ? 'lazy' : undefined} />;
}

function entryContent(entry: WorkLogEntryView, mediaUrl: (entry: WorkLogEntryView) => string | null) {
  const url = entry.attachment ? mediaUrl(entry) : null;
  return <>
    <time className="muted" dateTime={entry.createdAt}>{entry.createdAt}</time>
    {entry.title && <h3>{entry.title}</h3>}
    {entry.text && <p style={{ whiteSpace: 'pre-wrap' }}>{entry.text}</p>}
    {url && <figure>{mediaElement(entry, url, true)}</figure>}
  </>;
}

export function renderWorkLogDetail(props: {
  log: WorkLogView;
  canWrite: boolean;
  csrfToken: string;
  viewer?: HeaderViewer;
  timeline: WorkLogEntryView[];
  selector: WorkLogEntryView[];
  selectedIds: number[];
  shares: WorkLogShareView[];
  timelineLinks: PagerView;
  selectionLinks: PagerView;
  shareLinks: PagerView;
  timelinePage: number;
  selectionPage: number;
  linksPage: number;
  mediaUrl: (entry: WorkLogEntryView) => string;
  error?: string;
}): string {
  const selectorIds = new Set(props.selector.map((entry) => entry.id));
  const savedSelection = props.selectedIds.filter((id) => !selectorIds.has(id)).sort((a, b) => a - b).join(',');
  const previousSelectionPage = props.selectionLinks.previous
    ? new URL(props.selectionLinks.previous, 'https://work-log.invalid').searchParams.get('selection_page')
    : null;
  const nextSelectionPage = props.selectionLinks.next
    ? new URL(props.selectionLinks.next, 'https://work-log.invalid').searchParams.get('selection_page')
    : null;
  return shell({ title: `${props.log.title} · 작업 일지`, className: 'max-w-6xl', viewer: props.viewer }, <>
    <a href="/work-logs/" className="inline-flex min-h-11 items-center text-sm font-medium text-content-secondary hover:text-content">← 작업 일지</a>
    <header className="mt-2 flex flex-wrap items-end justify-between gap-3 border-b border-line pb-6">
      <h1>{props.log.title}</h1>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm"><p className="muted">비공개 작업 일지</p>
        <a className="inline-flex min-h-11 items-center text-danger hover:underline" href={`/work-logs/${props.log.id}/delete/`}>작업 일지 삭제</a></div>
    </header>
    <div className="mt-8 grid items-start gap-9 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
      <section aria-labelledby="entries-heading">
        {props.canWrite && <>
          <h2 id="entry-heading">Add an entry</h2>
          <form method="post" encType="multipart/form-data" action={`/work-logs/${props.log.id}/entry/`} className="mt-4 space-y-3 rounded-2xl border border-line bg-surface p-4 sm:p-5">
            {csrfInput(props.csrfToken)}
            <p><label>Title <input name="title" maxLength={100} /></label></p>
            <p><label>Note <textarea name="text" maxLength={5000} rows={4} /></label></p>
            <p className="muted">Image or video (up to 12 MB)</p>
            <input name="attachment" type="file" accept="image/png,image/jpeg,image/webp,video/mp4,video/webm" />
            <p><button>Save entry</button></p>
            {props.error && <p className="error" role="alert">{props.error}</p>}
          </form>
        </>}
        <h2 id="entries-heading" className="mt-9">Entries</h2>
        {props.timeline.length > 0 ? props.timeline.map((entry) => <article className="border-b border-line py-5" key={entry.id}>
          {entryContent(entry, props.mediaUrl)}
          <a href={`/work-logs/${props.log.id}/entry/${entry.id}/delete/`}>Delete entry</a>
        </article>) : <p className="muted">Your entries will appear here.</p>}
        {pager({ ...props.timelineLinks, anchor: 'entries-heading' }, 'Timeline pages')}
      </section>
      <section>
        {props.canWrite && <>
          <h2 id="share-heading">Share a snapshot</h2>
          {props.selector.length > 0 ? <form method="post" action={`/work-logs/${props.log.id}/share/`} className="mt-4 rounded-2xl border border-line bg-surface p-4 sm:p-5">
            {csrfInput(props.csrfToken)}
            <input type="hidden" name="selected_entries" value={savedSelection} />
            <input type="hidden" name="timeline_page" value={String(props.timelinePage)} />
            <input type="hidden" name="current_selection_page" value={String(props.selectionPage)} />
            <input type="hidden" name="links_page" value={String(props.linksPage)} />
            <p><label>What changed? <input name="headline" required maxLength={120} /></label></p>
            <fieldset>
              <legend>Entries to share</legend>
              {props.selector.map((entry) => <label key={entry.id} style={{ display: 'block' }}>
                <input type="checkbox" name="entries" value={String(entry.id)} defaultChecked={props.selectedIds.includes(entry.id)} />
                {entry.title || entry.text.slice(0, 52) || 'Attachment'}
              </label>)}
            </fieldset>
            {props.error && <p className="error" role="alert">{props.error}</p>}
            <p className="muted">Anyone with the link can see the entries you select.</p>
            <button name="action" value="preview">Preview share</button>{' '}
            <button name="action" value="publish">Create share link</button>
            {(previousSelectionPage || nextSelectionPage) && <nav aria-label="Entries to share">
              {previousSelectionPage && <button formNoValidate name="selection_page" value={previousSelectionPage}>Newer entries</button>}
              {nextSelectionPage && <button formNoValidate name="selection_page" value={nextSelectionPage}>Older entries</button>}
            </nav>}
          </form> : <p className="muted">Add an entry to create a share link.</p>}
        </>}
        {props.shares.length > 0 && <>
          <h2 id="share-links">Share links</h2>
          <ul>{props.shares.map((share) => <li key={share.id}>
            <a href={`/work-logs/share/${share.token}/`}>{share.headline}</a>
            <form method="post" action={`/work-logs/${props.log.id}/share/${share.token}/revoke/`}>
              {csrfInput(props.csrfToken)}
              <button>Stop sharing</button>
            </form>
          </li>)}</ul>
          {pager({ ...props.shareLinks, anchor: 'share-links' }, 'Share link pages')}
        </>}
      </section>
    </div>
  </>);
}

export function renderWorkLogDelete(props: {
  log: WorkLogView;
  entry?: WorkLogEntryView;
  csrfToken: string;
}): string {
  const action = props.entry
    ? `/work-logs/${props.log.id}/entry/${props.entry.id}/delete/`
    : `/work-logs/${props.log.id}/delete/`;
  const heading = props.entry ? 'Delete entry' : 'Delete work log';
  return shell({ title: `${heading} · ${props.log.title}` }, <>
    <h1>{heading}</h1>
    <p>{props.log.title}</p>
    {props.entry && <>
      <time className="muted" dateTime={props.entry.createdAt}>{props.entry.createdAt}</time>
      {(props.entry.title || props.entry.text) && <p>{(props.entry.title || props.entry.text).slice(0, 120)}</p>}
      <p>This removes the entry and its attachment from every share link. Links with no entries left will close.</p>
    </>}
    {!props.entry && <p>This deletes all entries and attachments in this work log and closes its share links.</p>}
    <a className="button" href={`/work-logs/${props.log.id}/`}>Cancel</a>
    <form method="post" action={action}>
      {csrfInput(props.csrfToken)}
      <button>Confirm {heading.toLowerCase()}</button>
    </form>
  </>);
}

export function renderWorkLogShared(props: {
  log: WorkLogView;
  ownerUsername: string;
  headline: string;
  entries: WorkLogEntryView[];
  cover: WorkLogEntryView | null;
  imageUrl: string | null;
  shareUrl: string;
  timelineLinks: PagerView;
  newLink: boolean;
  preview?: boolean;
  selectedIds?: number[];
  csrfToken: string;
  timelinePage?: number;
  selectionPage?: number;
  linksPage?: number;
  mediaUrl: (entry: WorkLogEntryView) => string;
}): string {
  const title = `${props.headline} · ${props.log.title}`;
  return shell({
    title,
    shareMeta: props.preview ? undefined : {
      title: props.headline,
      description: `${props.log.title} · ${props.ownerUsername}`,
      url: props.shareUrl,
      imageUrl: props.imageUrl ?? undefined,
    },
  }, <>
    {props.preview && <div>
      <p><strong>Share preview</strong></p>
      <form method="post" action={`/work-logs/${props.log.id}/share/`}>
        {csrfInput(props.csrfToken)}
        <input type="hidden" name="headline" value={props.headline} />
        <input type="hidden" name="selected_entries" value={(props.selectedIds ?? []).join(',')} />
        <input type="hidden" name="timeline_page" value={String(props.timelinePage ?? 1)} />
        <input type="hidden" name="current_selection_page" value={String(props.selectionPage ?? 1)} />
        <input type="hidden" name="links_page" value={String(props.linksPage ?? 1)} />
        <button name="action" value="edit">Edit selection</button>{' '}
        <button name="action" value="publish">Create share link</button>
      </form>
    </div>}
    {props.newLink && <section aria-labelledby="share-ready">
      <h2 id="share-ready">Share link is ready</h2>
      <input readOnly value={props.shareUrl} aria-label="Share link" />
    </section>}
    <article>
      <header>
        <p className="muted">{props.log.title}</p>
        <h1>{props.headline}</h1>
        <a href={`/@${encodeURIComponent(props.ownerUsername)}`}>@{props.ownerUsername}</a>
      </header>
      {props.cover && <figure>{mediaElement(props.cover, props.mediaUrl(props.cover))}
        {props.cover.title && <figcaption>{props.cover.title}</figcaption>}
      </figure>}
      <section aria-labelledby="timeline-heading">
        <h2 id="timeline-heading">How it came together</h2>
        {props.entries.map((entry) => <article key={entry.id}>
          {entryContent(entry, props.mediaUrl)}
        </article>)}
        {props.preview ? (() => {
          const previousPage = props.timelineLinks.previous
            ? new URL(props.timelineLinks.previous, 'https://work-log.invalid').searchParams.get('page')
            : null;
          const nextPage = props.timelineLinks.next
            ? new URL(props.timelineLinks.next, 'https://work-log.invalid').searchParams.get('page')
            : null;
          if (!previousPage && !nextPage) return null;
          return <form method="post" action={`/work-logs/${props.log.id}/share/`}>
            {csrfInput(props.csrfToken)}
            <input type="hidden" name="action" value="preview" />
            <input type="hidden" name="headline" value={props.headline} />
            <input type="hidden" name="selected_entries" value={(props.selectedIds ?? []).join(',')} />
            <input type="hidden" name="timeline_page" value={String(props.timelinePage ?? 1)} />
            <input type="hidden" name="current_selection_page" value={String(props.selectionPage ?? 1)} />
            <input type="hidden" name="links_page" value={String(props.linksPage ?? 1)} />
            {previousPage && <button name="preview_page" value={previousPage}>Newer entries</button>}{' '}
            {nextPage && <button name="preview_page" value={nextPage}>Older entries</button>}
          </form>;
        })() : pager({ ...props.timelineLinks, anchor: 'timeline-heading' }, 'Timeline pages')}
      </section>
    </article>
  </>);
}
