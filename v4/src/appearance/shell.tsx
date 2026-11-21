import type { ReactNode } from 'react';

export const siteStyleHref = '/assets/blex/theme.css';

interface Brand {
  siteName: string;
  logoUrl?: string | null;
  darkLogoUrl?: string | null;
  footerPages?: Array<{ title: string; slug: string }>;
}

export interface HeaderViewer {
  username?: string;
  hasEditorRole?: boolean;
  isStaff?: boolean;
  csrfToken?: string;
  unreadCount?: number;
}

const iconPaths: Record<string, ReactNode> = {
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
  moon: <path d="M20.9 13.34A9 9 0 0 1 10.66 3.1 9 9 0 1 0 20.9 13.34Z" />,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4m0-14.2-1.4 1.4M6.3 17.7l-1.4 1.4" /></>,
  pen: <><path d="m13.5 6.5 4 4M4 20l5-1 11-11a2.83 2.83 0 0 0-4-4L5 15l-1 5Z" /></>,
  chevron: <path d="m6 9 6 6 6-6" />,
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4" /></>,
  book: <path d="M6 3h13v18H6a3 3 0 0 1 0-6h13M6 3a3 3 0 0 0-3 3v12" />,
  user: <><circle cx="12" cy="8" r="4"/><path d="M4 21v-2a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v2" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="m19.4 15 .1 1.2 1.2 1.2-3 3-1.2-1.2-1.2-.1-.7 1.7h-4.2L9.7 19l-1.2.1-1.2 1.2-3-3 1.2-1.2.1-1.2-1.7-.7V10l1.7-.7-.1-1.2-1.2-1.2 3-3 1.2 1.2 1.2.1.7-1.7h4.2l.7 1.7 1.2-.1 1.2-1.2 3 3-1.2 1.2-.1 1.2 1.7.7v4.2Z" /></>,
  logout: <path d="M10 17l5-5-5-5m5 5H3m10-8h7v16h-7" />,
  heart: <path d="M20.8 8.7c0 4.5-8.8 9.7-8.8 9.7S3.2 13.2 3.2 8.7A4.5 4.5 0 0 1 12 7a4.5 4.5 0 0 1 8.8 1.7Z" />,
  share: <><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="m8.7 10.5 6.6-4m-6.6 7 6.6 4" /></>,
  comment: <path d="M21 11.5a8.4 8.4 0 0 1-8.8 8.2 9 9 0 0 1-3.5-.7L4 21l1.5-4a7.8 7.8 0 0 1-2.3-5.5A8.6 8.6 0 0 1 12 3.2a8.6 8.6 0 0 1 9 8.3Z" />,
  list: <path d="M9 6h12M9 12h12M9 18h12M4 6h.01M4 12h.01M4 18h.01" />,
  layers: <path d="m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5M3 16l9 5 9-5" />,
};

export function SiteIcon({ name, className }: { name: keyof typeof iconPaths; className?: string }) {
  return <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{iconPaths[name]}</svg>;
}

export function SiteTheme() {
  return <><link rel="stylesheet" href={siteStyleHref} data-blex-theme="" /><script type="module" src="/assets/blex/theme.js" /></>;
}

function SiteLogo({ brand, small }: { brand?: Brand; small?: boolean }) {
  const size = small ? 'h-6 w-auto' : 'h-6 w-auto md:h-7';
  const light = brand?.logoUrl ?? '/resources/logob.svg';
  const dark = brand?.darkLogoUrl ?? (brand?.logoUrl ? light : '/resources/logow.svg');
  const alt = brand?.siteName ?? 'BLEX';
  return <a href="/" className="group flex shrink-0 items-center" aria-label={alt}>
    <img src={light} alt="" className={`blex-site-logo-light ${size} transition-opacity duration-150 group-hover:opacity-70`} data-no-filter="" />
    <img src={dark} alt="" className={`blex-site-logo-dark ${size} transition-opacity duration-150 group-hover:opacity-70`} data-no-filter="" />
  </a>;
}

const iconButton = 'inline-flex size-11 items-center justify-center rounded-full text-content-secondary transition-all duration-150 hover:bg-surface-subtle hover:text-content active:scale-95 md:size-10';
const authLink = 'inline-flex min-h-9 shrink-0 items-center rounded-full px-4 py-2 text-sm font-medium transition-all duration-150 active:scale-95';

function ThemeButton({ bordered }: { bordered?: boolean }) {
  return <button type="button" data-site-theme-toggle className={`${iconButton} ${bordered ? 'border border-line-light' : ''}`} aria-label="다크 모드로 전환">
    <SiteIcon name="sun" className="blex-theme-sun" /><SiteIcon name="moon" className="blex-theme-moon" />
  </button>;
}

function QuickSearch() {
  return <div className="relative w-full max-w-xs" data-site-search>
    <form action="/search" className="flex h-11 items-center gap-2 rounded-full border border-line bg-surface-elevated px-3 transition-all focus-within:ring-2 focus-within:ring-line-strong">
      <SiteIcon name="search" className="size-4 shrink-0 text-content-hint" />
      <input name="q" type="search" placeholder="검색" aria-label="검색" autoComplete="off"
        className="min-w-0 flex-1 bg-transparent text-sm text-content placeholder:text-content-hint focus:outline-none" />
      <kbd className="hidden h-6 items-center gap-1 rounded-md border border-line bg-surface-subtle px-2 font-mono text-[10px] text-content-secondary lg:inline-flex"><span className="text-[8px]">⌘</span>K</kbd>
    </form>
    <div hidden className="absolute inset-x-0 z-50 mt-2 overflow-hidden rounded-2xl bg-surface-elevated shadow-xl ring-1 ring-line-strong/60" data-site-search-panel>
      <p className="border-b border-line-light px-3 py-2 text-[11px] font-semibold tracking-wider text-content-secondary" data-site-search-heading>최근 검색</p>
      <ul className="max-h-80 overflow-y-auto p-2" data-site-search-results />
    </div>
  </div>;
}

function AccountLinks({ viewer }: { viewer: HeaderViewer }) {
  const links: Array<[string, string, string]> = [
    ['/work-logs/', '작업 일지', 'book'],
    [viewer.username ? `/@${encodeURIComponent(viewer.username)}` : '/settings/profile', '프로필', 'user'],
    ['/settings/notify', '설정', 'settings'],
  ];
  if (viewer.isStaff) links.push(['/admin-settings/', '관리자 설정', 'settings']);
  return <>
    <div className="py-1">{links.map(([href, label, icon]) => <a key={href} href={href}
      className="flex items-center gap-3 px-4 py-3 text-sm text-content-secondary transition-colors duration-150 hover:bg-surface-subtle">
      <SiteIcon name={icon} className="size-4 text-content-hint" /><span>{label}</span>
    </a>)}</div>
    <form method="post" action="/logout" className="border-t border-line-light py-1" data-site-logout>
      <input type="hidden" name="csrfmiddlewaretoken" value={viewer.csrfToken ?? ''} />
      <button type="submit" className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-danger transition-colors duration-150 hover:bg-danger-surface">
        <SiteIcon name="logout" className="size-4" /> 로그아웃
      </button>
    </form>
  </>;
}

export interface SiteHeaderProps {
  brand?: Brand; viewer?: HeaderViewer | null; searchPage?: boolean; editorPage?: boolean; hideAuthLinks?: boolean;
}

export function SiteHeader({ brand, viewer, searchPage, editorPage, hideAuthLinks }: SiteHeaderProps) {
  return <header className="frosted-surface sticky top-0 right-0 left-0 z-30 border-b border-transparent transition-all duration-200" data-site-header>
    <div className="mx-auto max-w-7xl px-4 md:px-6">
      <div className="flex h-14 items-center md:h-16">
        <SiteLogo brand={brand} />
        <div className={`flex-1 ${searchPage ? '' : 'md:px-6'}`}>
          {!searchPage && <div className="hidden md:block"><QuickSearch /></div>}
        </div>
        <nav className="hidden shrink-0 items-center gap-2 md:flex" aria-label="계정 메뉴">
          <ThemeButton bordered />
          {viewer ? <>
            {viewer.hasEditorRole && !editorPage && <a href="/write" className={`${authLink} gap-1.5 bg-action text-content-inverted hover:bg-action-hover`}>
              <SiteIcon name="pen" className="size-3" /> 새 글
            </a>}
            <details className="blex-user-menu relative" data-account-menu>
              <summary className="relative flex cursor-pointer items-center gap-1.5 rounded-full py-1.5 pr-2 pl-1.5 transition-all duration-150 hover:bg-surface-subtle active:scale-95" aria-label="사용자 메뉴">
                <span className="flex size-8 items-center justify-center rounded-full bg-action text-xs font-semibold text-content-inverted">{viewer.username?.slice(0, 1).toUpperCase() || 'B'}</span>
                {Boolean(viewer.unreadCount) && <span className="absolute top-0 left-6 size-3.5 rounded-full bg-danger ring-2 ring-surface" />}
                <SiteIcon name="chevron" className="size-3 text-content-hint" />
              </summary>
              <div className="absolute right-0 z-50 mt-2 w-52 rounded-xl bg-surface-elevated py-1 shadow-lg ring-1 ring-line/50">
                <div className="border-b border-line-light px-4 py-3.5"><p className="text-xs text-content-secondary">로그인 계정</p><p className="mt-0.5 truncate text-sm font-semibold">{viewer.username}</p></div>
                <AccountLinks viewer={viewer} />
              </div>
            </details>
          </> : !hideAuthLinks && <>
            <a href="/login" className={`${authLink} text-content-secondary hover:bg-surface-subtle hover:text-content`}>로그인</a>
            <a href="/sign" className={`${authLink} bg-action text-content-inverted hover:bg-action-hover`}>회원가입</a>
          </>}
        </nav>
        <nav className="flex shrink-0 items-center gap-1 md:hidden" aria-label="모바일 메뉴">
          {!searchPage && <a href="/search" className={iconButton} aria-label="검색"><SiteIcon name="search" /></a>}
          {viewer && <a href="/settings/notify" className={iconButton} aria-label="알림"><SiteIcon name="bell" /></a>}
          <ThemeButton />
          <button type="button" className={iconButton} data-site-menu-open aria-label="메뉴" aria-controls="blex-mobile-menu" aria-expanded="false"><SiteIcon name="menu" /></button>
        </nav>
      </div>
    </div>
    <dialog id="blex-mobile-menu" className="blex-menu fixed inset-y-0 right-0 left-auto m-0 w-72 max-w-[90vw] bg-surface-elevated p-0 text-content shadow-xl">
      <div className="flex h-14 items-center justify-between border-b border-line-light px-4"><SiteLogo brand={brand} small />
        <form method="dialog"><button type="submit" className={iconButton} aria-label="메뉴 닫기"><SiteIcon name="close" /></button></form>
      </div>
      <nav className="py-2" aria-label="사이트 메뉴">
        <a href="/" className="block px-4 py-3 text-sm hover:bg-surface-subtle">최신 글</a>
        <a href="/tags" className="block px-4 py-3 text-sm hover:bg-surface-subtle">태그</a>
        {viewer ? <>
          {viewer.hasEditorRole && !editorPage && <a href="/write" className="block px-4 py-3 text-sm hover:bg-surface-subtle">새 글</a>}
          <AccountLinks viewer={viewer} />
        </> : !hideAuthLinks && <>
          <a href="/login" className="block px-4 py-3 text-sm hover:bg-surface-subtle">로그인</a>
          <a href="/sign" className="block px-4 py-3 text-sm hover:bg-surface-subtle">회원가입</a>
        </>}
      </nav>
    </dialog>
  </header>;
}

export function SiteFooter({ brand }: { brand?: Brand }) {
  return <footer className="mt-auto border-t border-line-light bg-surface">
    <div className="mx-auto max-w-7xl px-4 py-12 md:px-6">
      {Boolean(brand?.footerPages?.length) && <nav className="mb-8 flex flex-wrap justify-center gap-2" aria-label="사이트 정보">
        {brand?.footerPages?.map((page) => <a key={page.slug} href={`/static/${encodeURIComponent(page.slug)}`}
          className="rounded-lg px-4 py-2 text-sm text-content-secondary transition-all duration-150 hover:bg-surface-subtle hover:text-content">{page.title}</a>)}
      </nav>}
      <div className="flex flex-col items-center gap-3"><SiteLogo brand={brand} small />
        <p className="text-xs text-content-hint">© {new Date().getFullYear()} {brand?.siteName ?? 'BLEX'}. All rights reserved.</p>
      </div>
    </div>
  </footer>;
}
