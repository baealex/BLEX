import { type ReactNode } from 'react';
import { SiteIcon, type SiteIconName } from '../../../platform/views.js';
import { loginPromptProps } from '../../../platform/views.js';
import { authorPath, isEditor } from '../services/profile.js';
import { AuthorRow, AuthorSocialLink, PostRow, PublicPageViewer, SubscriptionState, avatarUrl, dateLabel, dateValue, h, mediaUrl, postCover, safeExternalUrl } from '../../discovery/shared.js';
import { EmptyState, postPath } from '../../discovery/pages/post-list.js';

function subscriptionControl(
  author: AuthorRow,
  state: SubscriptionState,
  viewer: PublicPageViewer | null,
  csrfToken: string,
  path: string,
): ReactNode {
  if (!state.canSubscribe) return null;
  const subscribeLabel = `${author.username}님의 새 글 구독`;
  if (!viewer) {
    return h('a', {
      ...loginPromptProps(path, 'subscribe'),
      'aria-label': subscribeLabel,
      className: 'inline-flex items-center gap-2 rounded-full bg-action px-5 py-2.5 text-sm font-semibold text-content-inverted transition-colors duration-150 hover:bg-action-hover active:scale-[0.98]',
    }, h(SiteIcon, { name: 'bell', className: 'text-xs' }), '구독');
  }
  return h('form', { className: 'mb-0', method: 'post', action: `/v1/users/@${encodeURIComponent(author.username)}/subscription` },
    h('input', { type: 'hidden', name: 'csrfmiddlewaretoken', value: csrfToken }),
    h('input', { type: 'hidden', name: 'returnTo', value: path }),
    state.isSubscribed ? h('input', { type: 'hidden', name: 'action', value: 'unsubscribe' }) : null,
    h('button', { type: 'submit', 'aria-pressed': state.isSubscribed, 'aria-label': subscribeLabel,
      className: `inline-flex items-center justify-center gap-2 rounded-full border px-5 py-2.5 text-sm font-semibold transition-all duration-150 ${state.isSubscribed ? 'border-line bg-surface text-content-secondary hover:border-line-strong hover:text-content' : 'border-transparent bg-action text-content-inverted hover:bg-action-hover active:scale-95'}` },
      h(SiteIcon, { name: state.isSubscribed ? 'check' : 'bell', className: 'text-xs' }),
      state.isSubscribed ? '구독 중' : '구독',
    ),
  );
}

export function featuredPostsSection(author: AuthorRow, featured: { kind: 'featured' | 'recent'; posts: PostRow[] }, isOwner: boolean): ReactNode {
  if (!featured.posts.length && !isOwner) return null;
  return h('section', { className: 'featured-section', 'data-featured-posts-section': true,
    'data-partial-url': `${authorPath(author.username)}/partials/featured-posts` },
    h('div', { className: 'mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between' },
      h('h2', { className: 'text-2xl font-bold tracking-tight text-content' }, featured.kind === 'featured' ? '추천 포스트' : '최근 포스트'),
      isOwner ? h('nav', { className: 'flex flex-wrap gap-2', 'aria-label': '작성자 글 관리' },
        h('a', { href: '/settings/pinned-posts', className: 'inline-flex items-center gap-2 rounded-full bg-surface px-4 py-2 text-sm font-semibold text-content-secondary ring-1 ring-line/60 transition-colors hover:bg-surface-subtle hover:text-content' },
          h(SiteIcon, { name: 'pin', className: 'text-xs' }), '고정 포스트 설정'),
      ) : null,
    ),
    featured.posts.length ? h('div', { className: 'grid grid-cols-1 gap-5 sm:grid-cols-2' }, ...featured.posts.map((post) =>
      h('a', { href: postPath(post), className: 'group block h-full', key: post.id },
        h('article', { className: 'flex h-full flex-col overflow-hidden rounded-2xl bg-surface ring-1 ring-line/60 transition-all duration-150 hover:ring-line-strong/70 active:scale-[0.99]' },
          h('div', { className: 'aspect-[16/9] overflow-hidden bg-surface-subtle' },
            h('img', { className: 'h-full w-full object-cover transition-transform duration-500 motion-safe:group-hover:scale-[1.03]', src: postCover(post), alt: post.title, loading: 'lazy' }),
          ),
          h('div', { className: 'flex flex-1 flex-col p-5' },
            h('h3', { className: 'line-clamp-2 text-md font-bold leading-snug text-content transition-colors group-hover:text-content-secondary' }, post.title),
            h('div', { className: 'mt-auto flex items-center gap-3 pt-4 text-xs text-content-hint' },
              post.publishedDate ? h('time', { dateTime: dateValue(post.publishedDate) ?? undefined }, dateLabel(post.publishedDate)) : null,
              h('span', { className: 'size-1 rounded-full bg-content-hint/70' }),
              h('span', null, `${post.readTime}분`),
            ),
          ),
        ),
      ),
    )) : EmptyState({ title: '아직 공개된 포스트가 없습니다.', actionUrl: '/write', actionLabel: '포스트 작성하기', actionIcon: 'edit' }),
  );
}

export function profileHeader(
  author: AuthorRow,
  isHeading: boolean,
  subscription: SubscriptionState = { canSubscribe: false, isSubscribed: false },
  viewer: PublicPageViewer | null = null,
  csrfToken = '',
  socialLinks: AuthorSocialLink[] = [],
  returnTo = authorPath(author.username),
): ReactNode {
  const homepage = safeExternalUrl(author.homepage);
  const isOwner = viewer?.id === author.id;
  const cover = author.cover ? h('div', { className: 'mx-auto max-w-4xl px-4 pt-6 sm:px-6 sm:pt-8' },
    h('div', { className: 'relative aspect-[3/1] w-full overflow-hidden rounded-2xl ring-1 ring-line/60' },
      h('img', { className: 'h-full w-full object-cover object-center', src: mediaUrl(author.cover) ?? undefined, alt: `${author.username}의 커버`, loading: 'lazy' }),
      h('div', { className: 'absolute inset-0 bg-surface-page/5' }),
      h('div', { className: 'absolute inset-x-0 bottom-0 h-14 bg-gradient-to-b from-transparent to-surface-page/35 sm:h-16 md:h-20' }),
      isOwner ? h('a', { href: '/settings/profile', className: 'absolute right-4 top-4 inline-flex items-center gap-2 rounded-full border border-white/30 bg-black/25 px-3 py-1.5 text-xs font-semibold text-white/90 backdrop-blur-sm transition-colors duration-150 hover:border-white/50 hover:bg-black/35 hover:text-white' },
        h(SiteIcon, { name: 'camera', className: 'text-[11px]' }), h('span', null, '커버 변경'),
      ) : null,
    ),
  ) : null;
  const displayUrl = homepage?.replace(/^https?:\/\//, '') ?? '';
  return h('div', { className: 'relative overflow-hidden pb-12 sm:pb-16' },
    cover,
    h('div', { className: `relative mx-auto max-w-4xl px-4 sm:px-6 ${author.cover ? '-mt-14 sm:-mt-16 md:-mt-20' : 'pt-12'}` },
      h('div', { className: 'flex flex-col items-center text-center' },
        h('div', { className: 'relative mb-6 sm:mb-8' },
          h('img', { className: 'relative size-28 rounded-full object-cover shadow-floating ring-4 ring-surface-page sm:size-32 md:size-40', src: avatarUrl(author.avatar), alt: author.username }),
          isOwner ? h('a', { href: '/settings/profile', title: '프로필 이미지 변경', 'aria-label': '프로필 이미지 변경', className: 'absolute bottom-1 right-1 flex size-9 items-center justify-center rounded-full border border-line bg-surface text-content-secondary shadow-subtle transition-colors duration-150 hover:border-line-strong hover:text-content' },
            h(SiteIcon, { name: 'pencil', className: 'text-xs' }),
          ) : null,
        ),
        isHeading
          ? h('h1', { className: 'mb-2 text-2xl font-bold tracking-tight text-content' }, author.username)
          : h('p', { className: 'mb-2 text-2xl font-bold tracking-tight text-content' }, author.username),
        author.bio ? h('p', { className: 'mx-auto mb-6 max-w-2xl px-4 text-md font-medium leading-relaxed text-content-secondary' }, author.bio) : null,
        subscription.canSubscribe ? h('div', { className: 'mb-6' }, subscriptionControl(author, subscription, viewer, csrfToken, returnTo)) : null,
        homepage ? h('div', { className: 'mb-8' },
          h('a', { href: homepage, target: '_blank', rel: 'noopener noreferrer', className: 'group inline-flex items-center gap-2 rounded-full border border-line bg-surface px-5 py-2.5 text-sm font-semibold text-content-secondary transition-colors duration-150 hover:border-line-strong hover:text-content' },
            h(SiteIcon, { name: 'link', className: 'text-xs text-content-hint transition-colors group-hover:text-content' }),
            h('span', null, displayUrl.length > 30 ? `${displayUrl.slice(0, 29)}…` : displayUrl),
          ),
        ) : null,
        socialLinks.length ? h('div', { className: 'mx-auto flex max-w-lg flex-wrap justify-center gap-3' },
          ...socialLinks.map((social) => {
            const icon = ({
              github: 'brand-github', twitter: 'brand-x', x: 'brand-x',
              threads: 'brand-threads', telegram: 'brand-telegram', facebook: 'brand-facebook',
              instagram: 'brand-instagram', linkedin: 'brand-linkedin', youtube: 'brand-youtube',
              tiktok: 'brand-tiktok', discord: 'brand-discord',
            } as Record<string, SiteIconName>)[social.name.toLowerCase()] ?? 'link';
            const label = social.name.toLowerCase() === 'twitter' ? 'X' : social.name;
            return h('a', { key: social.id, href: social.value, target: '_blank', rel: 'noopener noreferrer', title: label,
              className: 'flex size-10 items-center justify-center rounded-full border border-line bg-surface text-content-secondary transition-colors duration-150 hover:border-line-strong hover:text-content sm:size-11' },
              h(SiteIcon, { name: icon, className: 'text-lg' }),
              h('span', { className: 'sr-only' }, label),
            );
          }),
        ) : isOwner ? h('a', { href: '/settings/social-links',
          className: 'inline-flex items-center gap-2 rounded-full border border-dashed border-line-strong px-4 py-2 text-sm text-content-hint transition-colors duration-150 hover:border-line hover:text-content-secondary' },
          h(SiteIcon, { name: 'plus', className: 'text-xs' }), h('span', null, '소셜 링크 추가'),
        ) : null,
      ),
    ),
  );
}

export function AboutSection({ author, aboutHtml, isOwner }: { author: AuthorRow; aboutHtml: string; isOwner: boolean }): ReactNode {
  if (!aboutHtml && !isOwner) return null;
  const heading = h('div', { className: 'mb-6' }, h('h2', { className: 'text-2xl font-bold text-content' }, '소개'));
  if (!isOwner) return h('section', null, heading, h('div', { className: 'prose blog-post-content', dangerouslySetInnerHTML: { __html: aboutHtml } }));
  const editPath = `${authorPath(author.username)}/about/edit`;
  return h('section', { 'data-about-editor': '', 'data-about-url': editPath },
    heading,
    h('p', { 'data-about-message': '', hidden: true, className: 'mb-4 text-sm' }),
    h('div', { 'data-about-content': '', hidden: !aboutHtml, className: 'prose blog-post-content', dangerouslySetInnerHTML: { __html: aboutHtml } }),
    h('div', { 'data-about-empty': '', hidden: Boolean(aboutHtml), className: 'rounded-2xl border border-dashed border-line bg-surface px-5 py-6' },
      h('div', { className: 'flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between' },
        h('p', { className: 'min-w-0 text-sm font-semibold text-content' }, '아직 소개가 없습니다'),
        h('a', { href: editPath, 'data-about-edit': '', className: 'inline-flex items-center justify-center rounded-lg bg-surface-subtle px-4 py-2 text-sm font-semibold text-content-secondary transition-colors hover:bg-surface-subtle/80 hover:text-content' },
          h(SiteIcon, { name: 'edit', className: 'mr-2' }), '소개글 작성'),
      ),
    ),
    h('div', { 'data-about-actions': '', hidden: !aboutHtml, className: 'mt-6' },
      h('a', { href: editPath, 'data-about-edit': '', className: 'inline-flex items-center justify-center rounded-lg bg-surface-subtle px-4 py-2 text-sm font-semibold text-content-secondary transition-colors hover:bg-surface-subtle/80 hover:text-content' },
        h(SiteIcon, { name: 'edit', className: 'mr-2' }), '소개글 수정'),
    ),
    h('div', { 'data-about-form': '', hidden: true, className: 'rounded-2xl border border-line bg-surface p-4' },
      h('textarea', { 'data-about-input': '', defaultValue: author.aboutMarkdown ?? '', placeholder: '소개글을 작성하세요', 'aria-label': '소개',
        className: 'min-h-64 w-full resize-y rounded-xl border border-line bg-surface-subtle p-4 text-sm leading-relaxed text-content placeholder-content-hint focus:border-line-strong focus:outline-none focus:ring-2 focus:ring-line/10' }),
      h('div', { className: 'mt-4 flex justify-end gap-2' },
        h('button', { type: 'button', 'data-about-cancel': '', className: 'inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold text-content-secondary transition-colors hover:bg-surface-subtle hover:text-content disabled:opacity-50' }, '취소'),
        h('button', { type: 'button', 'data-about-save': '', className: 'inline-flex items-center justify-center rounded-lg bg-action px-4 py-2 text-sm font-semibold text-content-inverted transition-colors hover:bg-action-hover disabled:opacity-50' }, '저장'),
      ),
    ),
  );
}

export function authorTabs(author: AuthorRow, activeTab: 'overview' | 'posts' | 'series' | 'about'): ReactNode {
  if (!isEditor(author)) return h('div', { className: 'mb-8' });
  const tabs: Array<{ key: 'overview' | 'posts' | 'series'; href: string; label: string; count?: number }> = [
    { key: 'overview', href: authorPath(author.username), label: '개요' },
    { key: 'posts', href: authorPath(author.username, '/posts'), label: '포스트', count: author.publicPostCount },
    { key: 'series', href: authorPath(author.username, '/series'), label: '시리즈', count: author.publicSeriesCount },
  ];
  return h('div', { className: 'relative mb-10' },
    h('div', { className: 'hide-scrollbar flex justify-center overflow-x-auto pb-2 sm:pb-0' },
      h('nav', { className: 'inline-flex min-w-fit rounded-xl bg-surface-subtle/80 p-1.5 backdrop-blur-sm', 'aria-label': '작성자 메뉴' },
        ...tabs.map((tab) => h('a', { href: tab.href, key: tab.key, 'aria-current': activeTab === tab.key ? 'page' : undefined,
          className: `relative whitespace-nowrap rounded-lg px-6 py-2 text-sm font-bold transition-all duration-200 ${activeTab === tab.key ? 'bg-surface-elevated text-content shadow-sm' : 'text-content-secondary hover:text-content'}` },
          h('span', { className: 'relative z-10 flex items-center gap-2' },
            h('span', { className: 'flex items-center gap-1.5' },
              tab.label,
              tab.count !== undefined ? h('span', { className: `rounded-md px-1.5 py-0.5 text-[10px] ${activeTab === tab.key ? 'bg-action text-content-inverted' : 'bg-surface-elevated text-content-secondary ring-1 ring-line/80'}` }, String(tab.count)) : null,
            ),
          ),
        )),
      ),
    ),
  );
}
