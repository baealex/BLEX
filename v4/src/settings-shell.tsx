import { renderApplicationDocument } from './application/document.js';
import { createElement as h, type ComponentProps, type ReactNode } from 'react';
import { SiteHeader, SiteIcon, SiteTheme } from './appearance/shell.js';

export interface SettingsShellUser {
  username: string;
  hasEditorRole?: boolean;
  isStaff?: boolean;
  unreadCount?: number;
}

export interface SettingsShellCapabilities {
  canManageSiteSettings?: boolean;
  canManageLoginSettings?: boolean;
  canManageInvites?: boolean;
  canManageSiteContent?: boolean;
  canManageIntegrationSettings?: boolean;
  canManageGlobalWebhook?: boolean;
  canManageUtilities?: boolean;
}

interface NavigationItem {
  path: string;
  label: string;
  icon: 'bell' | 'book' | 'user' | 'settings';
  capability?: keyof SettingsShellCapabilities;
  editorOnly?: boolean;
  telegramOnly?: boolean;
}

interface NavigationSection {
  label: string;
  items: NavigationItem[];
  editorOnly?: boolean;
}

export interface SettingsShellOptions {
  mode: 'personal' | 'admin';
  title: string;
  currentPath: string;
  user: SettingsShellUser;
  csrfToken: string;
  content: ReactNode;
  headerAction?: ReactNode;
  brand?: ComponentProps<typeof SiteHeader>['brand'];
  capabilities?: SettingsShellCapabilities;
  canUseTelegramIntegration?: boolean;
}

const personalSections: NavigationSection[] = [
  {
    label: '일반',
    items: [
      { path: '/settings/notify', label: '알림', icon: 'bell' },
      { path: '/settings/subscriptions', label: '구독', icon: 'bell' },
      { path: '/settings/account', label: '계정', icon: 'user' },
      { path: '/settings/profile', label: '프로필', icon: 'user' },
      { path: '/settings/social-links', label: '소셜 링크', icon: 'user' },
      { path: '/settings/security', label: '계정 보안', icon: 'settings' },
    ],
  },
  {
    label: '블로그',
    editorOnly: true,
    items: [
      { path: '/settings/posts', label: '포스트', icon: 'book', editorOnly: true },
      { path: '/settings/series', label: '시리즈', icon: 'book', editorOnly: true },
      { path: '/settings/forms', label: '서식', icon: 'book', editorOnly: true },
      { path: '/settings/notices', label: '공지사항', icon: 'bell', editorOnly: true },
      { path: '/settings/banners', label: '배너', icon: 'book', editorOnly: true },
    ],
  },
  {
    label: '확장 기능',
    items: [
      { path: '/settings/integration', label: '텔레그램 연동', icon: 'settings', telegramOnly: true },
      { path: '/settings/webhook', label: '발행 채널', icon: 'settings', editorOnly: true },
      { path: '/settings/developer-api', label: '개발자 API', icon: 'settings', editorOnly: true },
    ],
  },
];

const adminSections: NavigationSection[] = [
  {
    label: '사이트',
    items: [
      { path: '/admin-settings/site-settings', label: '블로그 꾸미기', icon: 'settings', capability: 'canManageSiteSettings' },
      { path: '/admin-settings/login', label: '로그인 관리', icon: 'user', capability: 'canManageLoginSettings' },
      { path: '/admin-settings/seo-aeo', label: 'SEO/AEO', icon: 'book', capability: 'canManageSiteSettings' },
      { path: '/admin-settings/static-pages', label: '정적 페이지', icon: 'book', capability: 'canManageSiteContent' },
    ],
  },
  {
    label: '운영',
    items: [
      { path: '/admin-settings/global-notices', label: '전체 공지', icon: 'bell', capability: 'canManageSiteContent' },
      { path: '/admin-settings/global-banners', label: '전체 배너', icon: 'book', capability: 'canManageSiteContent' },
      { path: '/admin-settings/global-webhook', label: '전체 발행 채널', icon: 'settings', capability: 'canManageGlobalWebhook' },
    ],
  },
  {
    label: '확장 기능',
    items: [
      { path: '/admin-settings/integrations', label: '텔레그램', icon: 'settings', capability: 'canManageIntegrationSettings' },
    ],
  },
  {
    label: '관리',
    items: [
      { path: '/admin-settings/users', label: '사용자 권한', icon: 'user', capability: 'canManageInvites' },
      { path: '/admin-settings/utilities', label: '시스템 도구', icon: 'settings', capability: 'canManageUtilities' },
    ],
  },
];

const settingsCss = `
  .settings-ui { color: var(--color-content); }
  .settings-ui .panel { margin: 0 0 1.5rem; padding: 1.5rem; border-radius: 1rem; background: var(--color-surface); box-shadow: 0 0 0 1px color-mix(in srgb, var(--color-line) 60%, transparent); }
  @media (min-width: 48rem) { .settings-ui .panel { padding: 2rem; } }
  .settings-ui .panel > h2 { margin: 0 0 1.25rem; color: var(--color-content); font-size: 1rem; font-weight: 650; letter-spacing: -.01em; }
  .settings-ui .panel h3 { margin: 0 0 .75rem; color: var(--color-content); font-size: .95rem; font-weight: 600; }
  .settings-ui .muted { color: var(--color-content-secondary); font-size: .875rem; line-height: 1.6; }
  .settings-ui .settings-card { display: flex; min-height: 7rem; gap: 1rem; align-items: flex-start; padding: 1.25rem; border-radius: 1rem; background: var(--color-surface); box-shadow: 0 0 0 1px color-mix(in srgb, var(--color-line) 60%, transparent); color: inherit; text-decoration: none; transition: background-color .15s, box-shadow .15s, transform .15s; }
  .settings-ui .settings-card:hover { background: var(--color-surface-subtle); box-shadow: 0 0 0 1px var(--color-line-strong); transform: translateY(-1px); }
  .settings-ui .settings-card strong { display: block; margin-bottom: .35rem; color: var(--color-content); font-size: .95rem; font-weight: 650; }
  .settings-ui .settings-card > span:last-child { display: block; min-width: 0; flex: 1; color: var(--color-content-secondary); font-size: .85rem; line-height: 1.5; }
  .settings-ui .settings-card > span:last-child > span { display: block; }
  .settings-ui .settings-card-mark { display: inline-flex; width: 2.5rem; height: 2.5rem; flex: 0 0 auto; align-items: center; justify-content: center; border-radius: .75rem; background: var(--color-surface-subtle); color: var(--color-content-secondary); }
  .settings-ui .field { display: grid; gap: .4rem; margin: 1rem 0; }
  .settings-ui label { color: var(--color-content-secondary); font-size: .875rem; font-weight: 550; }
  .settings-ui input:not([type=checkbox]):not([type=file]):not([type=hidden]), .settings-ui textarea, .settings-ui select { width: 100%; min-height: 2.75rem; border: 1px solid var(--color-line); border-radius: .65rem; background: var(--color-surface); padding: .65rem .8rem; color: var(--color-content); font: inherit; }
  .settings-ui textarea { min-height: 8rem; resize: vertical; line-height: 1.6; }
  .settings-ui input[type=checkbox] { width: 1rem; height: 1rem; margin-right: .5rem; accent-color: var(--color-action); vertical-align: middle; }
  .settings-ui input[type=file]:not(.sr-only) { width: 100%; min-height: 2.75rem; padding: .55rem; border: 1px solid var(--color-line); border-radius: .65rem; background: var(--color-surface); color: var(--color-content-secondary); }
  .settings-ui input:focus-visible, .settings-ui textarea:focus-visible, .settings-ui select:focus-visible, .settings-ui button:focus-visible, .settings-ui a:focus-visible { outline: 2px solid var(--color-line-strong); outline-offset: 2px; }
  .settings-ui button { display: inline-flex; min-height: 2.75rem; align-items: center; justify-content: center; border: 1px solid transparent; border-radius: .65rem; background: var(--color-action); padding: .6rem 1rem; color: var(--color-content-inverted); font: inherit; font-size: .875rem; font-weight: 600; cursor: pointer; transition: background-color .15s, transform .15s; }
  .settings-ui button:hover { background: var(--color-action-hover); }
  .settings-ui button:active { transform: scale(.98); }
  .settings-ui button:disabled { cursor: not-allowed; opacity: .5; }
  .settings-ui button[type=button], .settings-ui .secondary-button { border-color: var(--color-line); background: var(--color-surface); color: var(--color-content); }
  .settings-ui .actions { display: flex; justify-content: flex-end; gap: .6rem; margin-top: 1.25rem; }
  .settings-ui [class="grid"] { grid-template-columns: repeat(auto-fit, minmax(min(100%, 15rem), 1fr)); gap: .5rem 1rem; }
  .settings-ui .status { margin: 0 0 1rem; border-radius: .75rem; padding: .9rem 1rem; font-size: .9rem; }
  .settings-ui .success { border: 1px solid var(--color-success-line); background: var(--color-success-surface); color: var(--color-success); }
  .settings-ui .error { border: 1px solid var(--color-danger-line); background: var(--color-danger-surface); color: var(--color-danger); }
  .settings-ui .provider { border-top: 1px solid var(--color-line-light); padding: 1rem 0; }
  .settings-ui .provider:first-child { border-top: 0; }
  .settings-ui .profile-image { display: block; max-width: 100%; max-height: 15rem; margin: .5rem 0 1rem; border-radius: .75rem; object-fit: cover; }
  .settings-ui .social-row { border-top: 1px solid var(--color-line-light); padding: .7rem 0; }
  .settings-ui .social-actions { display: flex; flex-wrap: wrap; align-items: end; gap: .6rem; }
  .settings-ui .social-actions .field { flex: 1 1 10rem; }
  .settings-ui .value { margin: .15rem 0; }
  .settings-ui pre { overflow: auto; border: 1px solid var(--color-line-light); border-radius: .75rem; background: var(--color-surface-subtle); padding: 1rem; color: var(--color-content-secondary); }
  .settings-ui ul, .settings-ui ol { padding-left: 1.3rem; }
  .settings-ui .muted a, .settings-ui a:not(.settings-card) { text-underline-offset: .18em; }
  .settings-ui .notification-config { position: relative; }
  .settings-ui .notification-config > summary { display: inline-flex; min-height: 2.75rem; align-items: center; gap: .5rem; border: 1px solid var(--color-line); border-radius: .65rem; background: var(--color-surface); padding: .55rem .85rem; color: var(--color-content-secondary); font-size: .875rem; font-weight: 600; cursor: pointer; list-style: none; }
  .settings-ui .notification-config > summary::-webkit-details-marker { display: none; }
  .settings-ui .notification-config-panel { position: absolute; top: calc(100% + .5rem); right: 0; z-index: 20; width: min(26rem, calc(100vw - 2rem)); border: 1px solid var(--color-line); border-radius: 1rem; background: var(--color-surface); padding: 1rem; box-shadow: 0 1.5rem 3rem rgb(15 23 42 / .18); }
  .settings-ui .notification-option { display: flex; min-height: 3rem; align-items: center; justify-content: space-between; gap: 1rem; border-radius: .75rem; padding: .5rem .6rem; color: var(--color-content-secondary); font-size: .875rem; }
  .settings-ui .notification-option:hover { background: var(--color-surface-subtle); }
  .settings-ui .notification-list, .settings-ui .subscription-list { display: grid; gap: .75rem; margin: 0; padding: 0; list-style: none; }
  .settings-ui .notification-item, .settings-ui .subscription-item { display: flex; min-width: 0; align-items: flex-start; gap: 1rem; border-radius: 1rem; background: var(--color-surface); padding: 1rem 1.15rem; box-shadow: 0 0 0 1px color-mix(in srgb, var(--color-line) 60%, transparent); }
  .settings-ui .notification-item.unread { box-shadow: 0 0 0 1px color-mix(in srgb, var(--color-action) 35%, var(--color-line)); }
  .settings-ui .notification-copy, .settings-ui .subscription-copy { min-width: 0; flex: 1; }
  .settings-ui .notification-link { color: var(--color-content); font-weight: 600; line-height: 1.55; text-decoration: none; }
  .settings-ui .notification-link:hover { text-decoration: underline; }
  .settings-ui .notification-meta { display: flex; flex-wrap: wrap; align-items: center; gap: .4rem .6rem; margin-top: .45rem; color: var(--color-content-hint); font-size: .75rem; }
  .settings-ui .notification-new { border: 1px solid var(--color-danger-line); border-radius: .3rem; background: var(--color-danger-surface); padding: .12rem .4rem; color: var(--color-danger); font-size: .65rem; font-weight: 700; }
  .settings-ui .notification-read-form, .settings-ui .subscription-action { flex: 0 0 auto; margin: 0; }
  .settings-ui .notification-read-form button, .settings-ui .subscription-action button { min-height: 2.5rem; border-color: var(--color-line); background: var(--color-surface); padding: .45rem .75rem; color: var(--color-content-secondary); }
  .settings-ui .telegram-prompt { display: flex; min-height: 7rem; align-items: center; justify-content: space-between; gap: 1.5rem; margin-bottom: 1.5rem; }
  .settings-ui .subscription-avatar { width: 2.75rem; height: 2.75rem; flex: 0 0 auto; border-radius: 50%; object-fit: cover; background: var(--color-surface-subtle); }
  .settings-ui .pagination { display: flex; justify-content: space-between; gap: 1rem; margin-top: 1rem; }
  .settings-ui .pagination a { display: inline-flex; min-height: 2.75rem; align-items: center; border: 1px solid var(--color-line); border-radius: .65rem; background: var(--color-surface); padding: .5rem .85rem; color: var(--color-content-secondary); font-size: .875rem; text-decoration: none; }
  .settings-ui .settings-secondary-link { display: inline-flex; min-height: 2.5rem; align-items: center; justify-content: center; gap: .45rem; border: 1px solid var(--color-line); border-radius: .65rem; background: var(--color-surface); padding: .45rem .7rem; color: var(--color-content-secondary); font-size: .75rem; font-weight: 600; text-decoration: none; }
  .settings-ui .settings-secondary-link:hover { background: var(--color-surface-subtle); color: var(--color-content); }
  .settings-ui .token-list, .settings-ui .webhook-channel-list { display: grid; gap: .75rem; margin: 0; padding: 0; list-style: none; }
  .settings-ui .token-status, .settings-ui .webhook-channel-status { display: inline-flex; align-items: center; border: 1px solid var(--color-line); border-radius: .4rem; padding: .15rem .45rem; font-size: .7rem; font-weight: 650; }
  .settings-ui .token-status.active, .settings-ui .webhook-channel-status.active { border-color: var(--color-success-line); background: var(--color-success-surface); color: var(--color-success); }
  .settings-ui .token-status.expired { border-color: var(--color-warning-line); background: var(--color-warning-surface); color: var(--color-warning); }
  .settings-ui .token-status.revoked, .settings-ui .webhook-channel-status.inactive { border-color: var(--color-danger-line); background: var(--color-danger-surface); color: var(--color-danger); }
  .settings-ui .scope-option { display: flex; align-items: flex-start; gap: .75rem; padding: .75rem .25rem; }
  .settings-ui .scope-option > input { margin-top: .22rem; }
  .settings-ui .scope-option strong, .settings-ui .scope-option span > span { display: block; }
  .settings-ui .scope-option strong { color: var(--color-content); font-size: .875rem; }
  .settings-ui .scope-option span > span { margin-top: .2rem; color: var(--color-content-secondary); font-size: .8rem; line-height: 1.5; }
  .settings-ui .token-security-note { display: flex; align-items: flex-start; gap: .75rem; margin-top: 1rem; border: 1px solid var(--color-line); border-radius: .8rem; background: var(--color-surface-subtle); padding: 1rem; color: var(--color-content-secondary); }
  .settings-ui .token-security-note p { margin: 0; font-size: .8rem; line-height: 1.6; }
  .settings-ui .telegram-connection-card { display: flex; flex-wrap: wrap; align-items: center; gap: 1.5rem; margin-top: 1rem; border-radius: .9rem; background: var(--color-surface-subtle); padding: 1rem; }
  .settings-ui .telegram-qr { width: 13rem; max-width: 100%; height: auto; border-radius: .75rem; background: white; }
  .settings-ui .telegram-connect-link { display: inline-flex; min-height: 2.75rem; align-items: center; border-radius: .65rem; background: var(--color-action); padding: .5rem .9rem; color: var(--color-content-inverted); font-size: .875rem; font-weight: 600; text-decoration: none; }
  .settings-ui .telegram-code { display: inline-block; border: 1px solid var(--color-line); border-radius: .5rem; background: var(--color-surface); padding: .5rem .75rem; font: 600 1.1rem/1.4 ui-monospace, monospace; letter-spacing: .14em; }
  .settings-ui .webhook-channel-card { display: flex; min-width: 0; align-items: center; gap: 1rem; border: 1px solid var(--color-line-light); border-radius: .8rem; padding: 1rem; }
  .settings-ui .webhook-empty-state { display: flex; min-height: 7rem; flex-direction: column; align-items: center; justify-content: center; gap: .7rem; color: var(--color-content-secondary); text-align: center; }
  .settings-ui .webhook-empty-state p { margin: 0; font-size: .875rem; }
  @media (max-width: 38rem) { .settings-ui .notification-item, .settings-ui .subscription-item { flex-wrap: wrap; } .settings-ui .notification-read-form, .settings-ui .subscription-action { width: 100%; } .settings-ui .notification-read-form button, .settings-ui .subscription-action button { width: 100%; } }
  .settings-mobile-nav summary::-webkit-details-marker { display: none; }
  @media (max-width: 79.999rem) {
    .settings-mobile-nav[open]::before { content: ''; position: fixed; inset: 0; z-index: 40; background: rgb(15 23 42 / .48); backdrop-filter: blur(2px); }
    .settings-mobile-nav[open] > summary { position: fixed; z-index: 52; top: .75rem; left: min(14.25rem, calc(100vw - 3.25rem)); display: flex; width: 2.75rem; height: 2.75rem; min-height: 2.75rem; justify-content: center; border: 0; background: transparent; padding: 0; box-shadow: none; }
    .settings-mobile-nav[open] > summary .settings-mobile-summary-label,
    .settings-mobile-nav[open] > summary .settings-mobile-summary-current,
    .settings-mobile-nav > summary .settings-mobile-close-icon { display: none; }
    .settings-mobile-nav[open] > summary .settings-mobile-close-icon { display: block; }
    .settings-mobile-nav[open] .settings-mobile-panel { position: fixed; inset: 0 auto 0 0; z-index: 50; display: block; width: min(17.5rem, 90vw); overflow-y: auto; overscroll-behavior: contain; background: var(--color-surface); padding: 1.5rem; box-shadow: 1rem 0 3rem rgb(15 23 42 / .2); }
  }
`;

function normalizedPath(path: string): string {
  return path.replace(/[?#].*$/, '').replace(/\/+$/, '') || '/';
}

function visibleItems(options: SettingsShellOptions, sections: NavigationSection[]): Array<NavigationSection & { visibleItems: NavigationItem[] }> {
  return sections.map((section) => ({
    ...section,
    visibleItems: section.items.filter((item) => {
      if (item.editorOnly && !options.user.hasEditorRole) return false;
      if (item.telegramOnly && !options.canUseTelegramIntegration) return false;
      if (item.capability && options.capabilities?.[item.capability] !== true) return false;
      return true;
    }),
  })).filter((section) => section.visibleItems.length > 0);
}

function itemHref(path: string, username: string): string {
  return path.replace('{username}', encodeURIComponent(username));
}

function iconName(name: NavigationItem['icon']): 'bell' | 'book' | 'user' | 'settings' {
  return name;
}

function navigationList(
  options: SettingsShellOptions,
  sections: Array<NavigationSection & { visibleItems: NavigationItem[] }>,
) {
  const current = normalizedPath(options.currentPath);
  return sections.map((section) => h('section', { key: section.label },
    h('h2', { className: 'mb-1 px-3 text-xs font-semibold uppercase tracking-wider text-content-hint' }, section.label),
    h('ul', { className: 'm-0 list-none space-y-1 p-0' }, section.visibleItems.map((item) => {
      const href = itemHref(item.path, options.user.username);
      const isActive = current === normalizedPath(href) || (href !== '/settings/' && current.startsWith(`${normalizedPath(href)}/`));
      return h('li', { key: href }, h('a', {
        href,
        ...(isActive ? { 'aria-current': 'page' } : {}),
        className: `group flex min-h-11 items-center rounded-lg px-3 py-2 text-sm transition-all duration-150 active:scale-95 [@media(pointer:fine)]:min-h-9 ${isActive ? 'bg-surface-subtle font-semibold text-content' : 'font-medium text-content-secondary hover:bg-surface-subtle hover:text-content'}`,
      },
      h('span', { className: `mr-3 inline-flex w-5 shrink-0 justify-center ${isActive ? 'text-content' : 'text-content-hint'}` },
        h(SiteIcon, { name: iconName(item.icon), className: 'h-4 w-4' })),
      h('span', { className: 'min-w-0 flex-1' }, item.label)));
    })),
  ));
}

function settingsModeLink(options: SettingsShellOptions) {
  const href = options.mode === 'admin' ? '/settings/notify' : '/admin-settings/';
  const label = options.mode === 'admin' ? '← 개인 설정으로 돌아가기' : '관리자 설정';
  if (options.mode === 'personal' && !options.user.isStaff) return null;
  return h('a', {
    href,
    className: 'mt-3 inline-flex min-h-9 items-center rounded-lg text-xs font-medium text-content-hint underline-offset-4 hover:text-content hover:underline',
  }, label);
}

export function renderSettingsShell(options: SettingsShellOptions): string {
  const titleLabel = options.mode === 'admin' ? '관리자 설정' : '설정';
  const sections = visibleItems(options, options.mode === 'admin' ? adminSections : personalSections);
  const mobileNav = h('details', { className: 'settings-mobile-nav xl:hidden pt-4' },
    h('summary', { className: 'flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-xl border border-line bg-surface px-3 text-left shadow-subtle' },
      h('span', { className: 'settings-mobile-summary-label flex min-w-0 items-center gap-2 text-sm font-semibold text-content' },
        h(SiteIcon, { name: 'settings', className: 'h-4 w-4 shrink-0' }), titleLabel),
      h('span', { className: 'settings-mobile-summary-current flex min-w-0 items-center gap-2 text-sm font-medium text-content-secondary' },
        h('span', { className: 'truncate' }, options.title),
        h(SiteIcon, { name: 'chevron', className: 'h-4 w-4 shrink-0 transition-transform' })),
      h(SiteIcon, { name: 'close', className: 'settings-mobile-close-icon h-5 w-5 text-content-secondary' }),
    ),
    h('div', { className: 'settings-mobile-panel hidden' },
      h('div', { className: 'mb-6 flex min-h-11 items-center' }, h('p', { className: 'text-xl font-semibold tracking-tight text-content' }, titleLabel)),
      h('div', { className: 'mb-6' }, settingsModeLink(options)),
      h('nav', { 'aria-label': `${titleLabel} 메뉴`, className: 'space-y-6' }, navigationList(options, sections))),
  );

  const desktopNav = h('aside', { className: 'sticky top-24 mt-8 hidden w-64 flex-shrink-0 self-start xl:block' },
    h('div', { className: 'mb-5 px-3' },
      h('p', { className: 'text-lg font-semibold tracking-tight text-content' }, titleLabel),
      settingsModeLink(options)),
    h('div', { className: 'max-h-[calc(100vh-224px)] overflow-y-auto overscroll-contain pr-2' },
      h('nav', { 'aria-label': `${titleLabel} 메뉴`, className: 'space-y-6 pb-4' }, navigationList(options, sections))),
  );

  const headerViewer = {
    username: options.user.username,
    hasEditorRole: options.user.hasEditorRole,
    isStaff: options.mode === 'admin' || options.user.isStaff,
    csrfToken: options.csrfToken,
    unreadCount: options.user.unreadCount,
  };

  return renderApplicationDocument(h('html', { lang: 'ko' },
    h('head', null,
      h('meta', { charSet: 'utf-8' }),
      h('meta', { name: 'viewport', content: 'width=device-width, initial-scale=1' }),
      h('meta', { name: 'robots', content: 'noindex,nofollow,noarchive' }),
      h('meta', { name: 'referrer', content: 'same-origin' }),
      h('title', null, `${options.title} · ${titleLabel}`),
      h(SiteTheme),
      h('style', null, settingsCss),
    ),
    h('body', { className: 'min-h-screen bg-surface-page text-content' },
      h(SiteHeader, { viewer: headerViewer, brand: options.brand }),
      h('div', { className: 'mx-auto w-full max-w-7xl px-4 sm:px-6' },
        mobileNav,
        h('div', { className: 'flex flex-col gap-6 xl:flex-row xl:items-start xl:gap-8' },
          desktopNav,
          h('main', { className: 'settings-ui min-w-0 flex-1 py-6' },
            h('header', { className: 'mb-5 flex flex-wrap items-center justify-between gap-3' },
              h('h1', { className: 'text-xl font-semibold tracking-tight text-content' }, options.title),
              options.headerAction ? h('div', { className: 'shrink-0' }, options.headerAction) : null),
            options.content,
          ),
        ),
      ),
    ),
  ));
}
