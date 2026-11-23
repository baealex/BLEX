import type { ReactNode } from 'react';
import { SiteIcon } from '../../appearance/icons';
import { SiteFooter, SiteHeader, SiteTheme } from '../../appearance/shell';
import { renderApplicationDocument, scriptJson } from '../../application/document';
import type { NoticeRow, PageMeta, SiteBrand } from '../../contracts/public';
import { h } from './view-helpers';

export function PublicSiteMark({ brand, siteName, imageClass }: { brand?: SiteBrand; siteName: string; imageClass?: string }): ReactNode {
  const customLogo = brand?.logoUrl ?? brand?.darkLogoUrl;
  return h('span', { className: 'site-mark' },
    h('picture', null,
      h('source', {
 media: '(prefers-color-scheme: dark)',
srcSet: brand?.darkLogoUrl ?? customLogo ?? '/resources/logow.svg'
}),
      h('img', {
 className: imageClass,
src: customLogo ?? '/resources/logob.svg',
alt: customLogo ? siteName : ''
})
    ),
    customLogo ? null : h('span', null, siteName)
  );
}

export function PublicFooterLinks({ brand }: { brand?: SiteBrand }): ReactNode {
  return h('nav', {
 'aria-label': '사이트 정보',
className: 'site-footer-links'
},
    ...(brand?.footerPages ?? []).map(({ slug, title }) => h('a', {
 key: slug,
href: `/static/${encodeURIComponent(slug)}`
}, title)),
    h('a', { href: '/rss' }, 'RSS')
  );
}

export function PageLayout({ meta, children }: { meta: PageMeta; children: ReactNode }): string {
  const robots = meta.brand?.seoEnabled === false ? 'noindex,nofollow' : meta.robots;
  const structuredData = meta.structuredData
    ? h('script', {
 type: 'application/ld+json',
dangerouslySetInnerHTML: { __html: scriptJson(meta.structuredData) }
})
    : null;

  return renderApplicationDocument(h('html', { lang: 'ko' },
    h('head', null,
      h('meta', { charSet: 'utf-8' }),
      h('meta', {
 name: 'viewport',
content: 'width=device-width, initial-scale=1'
}),
      h('meta', {
 name: 'color-scheme',
content: 'light dark'
}),
      h('title', null, meta.title),
      h('meta', {
 name: 'description',
content: meta.description
}),
      h('meta', {
 property: 'og:type',
content: 'website'
}),
      h('meta', {
 property: 'og:title',
content: meta.title
}),
      h('meta', {
 property: 'og:description',
content: meta.description
}),
      h('meta', {
 property: 'og:url',
content: meta.canonical
}),
      h('meta', {
 name: 'twitter:card',
content: 'summary'
}),
      h('meta', {
 name: 'twitter:title',
content: meta.title
}),
      h('meta', {
 name: 'twitter:description',
content: meta.description
}),
      h('link', {
 rel: 'icon',
href: meta.brand?.faviconUrl ?? '/favicon.ico'
}),
      h('link', {
 rel: 'canonical',
href: meta.canonical
}),
      meta.markdownUrl ? h('link', {
 rel: 'alternate',
type: 'text/markdown',
href: meta.markdownUrl
}) : null,
      meta.brand?.seoEnabled === false ? null : h('link', {
        rel: 'alternate',
type: 'application/rss+xml',
title: `${meta.siteName} RSS`,
href: new URL('/rss', meta.canonical).href
      }),
      meta.brand?.seoEnabled !== false && meta.authorFeed
        ? h('link', {
 rel: 'alternate',
type: 'application/rss+xml',
title: meta.authorFeed.title,
href: meta.authorFeed.url
})
        : null,
      robots ? h('meta', {
 name: 'robots',
content: robots
}) : null,
      robots ? h('meta', {
 name: 'googlebot',
content: robots
}) : null,
      meta.previous ? h('link', {
 rel: 'prev',
href: meta.previous
}) : null,
      meta.next ? h('link', {
 rel: 'next',
href: meta.next
}) : null,
      h(SiteTheme),
      structuredData
    ),
    h('body', null,
      h(SiteHeader, {
 brand: meta.brand,
viewer: meta.viewer,
searchPage: meta.searchPage
}),
      h('main', null, children),
      h(SiteFooter, { brand: meta.brand })
    )
  ));
}

function noticeLink(value: string): string | null {
  const candidate = value.trim();
  // eslint-disable-next-line no-control-regex
  if (!candidate || /[\x00-\x20\x7f\\]/.test(candidate)) return null;
  const normalized = candidate.replace(/&(?:#0*58|#x0*3a|colon);/gi, ':')
    .replace(/&(?:#0*47|#x0*2f|sol);/gi, '/');
  if (/^\/\//.test(normalized)) return null;
  try {
    const parsed = new URL(normalized, 'https://blex.invalid');
    if (parsed.username || parsed.password) return null;
    if (!['http:', 'https:', 'mailto:'].includes(parsed.protocol)) return null;
    if ((parsed.protocol === 'http:' || parsed.protocol === 'https:') && !parsed.hostname) return null;
    return normalized;
  } catch {
    return null;
  }
}

export function NoticeSection({ notices, scope }: { notices: NoticeRow[]; scope: 'global' | 'user' }): ReactNode {
  if (!notices.length) return null;
  if (scope === 'global') {
    return h('section', {
 className: 'mb-6',
'aria-label': '사이트 공지사항',
'data-notice-carousel': ''
},
      ...notices.map((notice, index) => {
        const href = noticeLink(notice.url);
        const content = h('div', { className: 'flex items-center gap-4' },
          h('div', { className: 'flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface-subtle text-content-secondary' },
            h(SiteIcon, {
 name: 'speakerphone',
className: 'text-sm'
})
          ),
          h('div', { className: 'min-w-0 flex-1' },
            h('div', { className: 'mb-1.5 flex items-center gap-2' },
              h('span', { className: 'rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wider text-content-hint' }, '사이트 공지'),
              notices.length > 1 ? h('span', { className: 'text-[10px] font-medium tabular-nums text-content-hint' }, `${index + 1}/${notices.length}`) : null
            ),
            h('h2', { className: 'truncate text-base font-semibold leading-snug text-content' }, notice.title)
          ),
          h('span', { className: 'flex size-9 shrink-0 items-center justify-center rounded-full text-content-hint' },
            h(SiteIcon, {
 name: 'arrow-right',
className: 'text-sm'
})
          )
        );
        const props = {
 className: 'group block rounded-2xl border border-line/50 bg-transparent px-5 py-4 transition-colors duration-150 hover:border-line/70 active:bg-surface-subtle/40',
'data-notice-slide': ''
};
        return href ? h('a', {
 ...props,
href,
key: notice.id
}, content) : h('div', {
 ...props,
key: notice.id
}, content);
      }),
      notices.length > 1 ? h('div', {
 className: 'mt-3 flex items-center justify-center gap-2',
'data-notice-controls': '',
hidden: true
},
        h('button', {
 type: 'button',
className: 'flex size-8 items-center justify-center rounded-full text-content-hint hover:text-content-secondary',
'data-notice-step': '-1',
'aria-label': '이전 공지'
},
          h(SiteIcon, {
 name: 'chevron-left',
className: 'text-xs'
})
        ),
        h('div', { className: 'flex items-center gap-1.5' }, ...notices.map((notice, index) => h('button', {
          key: notice.id,
type: 'button',
className: 'blex-notice-dot h-1.5 rounded-full transition-colors duration-150',
'data-notice-index': index,
          'aria-label': `${index + 1}번째 공지 보기`,
'aria-pressed': index === 0
        }))),
        h('button', {
 type: 'button',
className: 'flex size-8 items-center justify-center rounded-full text-content-hint hover:text-content-secondary',
'data-notice-step': '1',
'aria-label': '다음 공지'
},
          h(SiteIcon, {
 name: 'chevron-right',
className: 'text-xs'
})
        )
      ) : null
    );
  }
  return h('section', {
 className: 'mb-14',
'aria-label': '작성자 공지사항'
},
    h('div', { className: 'mb-4 flex items-end justify-between gap-4' },
      h('h2', { className: 'text-2xl font-bold tracking-tight text-content' }, '공지'),
      notices.length > 1 ? h('span', { className: 'pb-1 text-xs font-medium tabular-nums text-content-hint' }, `${notices.length}개`) : null
    ),
    h('div', { className: 'divide-y divide-line-light border-y border-line-light' },
      ...notices.map((notice, index) => {
        const href = noticeLink(notice.url);
        const content = h('div', { className: 'flex items-center justify-between gap-4 px-1' },
          h('div', { className: 'min-w-0 flex-1' },
            h('h3', { className: 'truncate text-base font-semibold leading-snug text-content' }, notice.title)
          ),
          h('div', { className: 'flex shrink-0 items-center gap-2 text-content-hint' },
            notices.length > 1 ? h('span', { className: 'text-[11px] font-medium tabular-nums' }, `${index + 1}/${notices.length}`) : null,
            h(SiteIcon, {
 name: 'arrow-right',
className: 'text-xs'
})
          )
        );
        const props = { className: 'group block py-3.5 transition-colors duration-150 hover:bg-surface-subtle/50 active:bg-surface-subtle/70' };
        return href ? h('a', {
 ...props,
href,
key: notice.id
}, content) : h('div', {
 ...props,
key: notice.id
}, content);
      })
    )
  );
}
