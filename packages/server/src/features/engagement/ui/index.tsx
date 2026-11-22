import { createElement, Fragment } from 'react';
import type { ReaderAuthorHeader, ReaderPostView } from '../index.js';
import { PostCommentsApp, type PostCommentsModel } from './comments.js';
import { loginPromptProps } from './login-prompt.js';

const h = createElement;

export interface ReaderActionsProps {
  view: ReaderPostView;
  csrfToken: string;
  returnTo?: string;
}

export interface AuthorHeaderProps {
  author: ReaderAuthorHeader;
  viewerAuthenticated: boolean;
  csrfToken: string;
  returnTo: string;
  compact?: boolean;
}

const styles = `
  .reader-actions { display: grid; gap: 1.25rem; margin: 3.5rem 0; color: CanvasText; }
  .reader-card { overflow: hidden; border: 1px solid color-mix(in srgb, CanvasText 14%, Canvas); border-radius: 1rem; background: color-mix(in srgb, Canvas 97%, CanvasText); }
  .reader-author-cover { width: 100%; max-height: 15rem; aspect-ratio: 3 / 1; object-fit: cover; }
  .reader-author { display: flex; align-items: flex-start; gap: 1rem; padding: 1.2rem; }
  .reader-author-avatar { width: 4rem; height: 4rem; flex: 0 0 auto; object-fit: cover; border: 2px solid color-mix(in srgb, CanvasText 16%, Canvas); border-radius: 50%; background: color-mix(in srgb, CanvasText 7%, Canvas); }
  .reader-author-copy { min-width: 0; flex: 1; }
  .reader-author-name { font-weight: 750; font-size: 1.08rem; text-decoration: none; }
  .reader-author-bio { color: GrayText; margin: .25rem 0 .6rem; white-space: pre-wrap; }
  .reader-author-links { display: flex; flex-wrap: wrap; gap: .6rem; font-size: .88rem; }
  .reader-actions a { color: inherit; text-underline-offset: .18em; }
  .reader-card button { min-height: 2.5rem; padding: .45rem .8rem; border: 1px solid color-mix(in srgb, CanvasText 22%, Canvas); border-radius: .65rem; background: Canvas; color: CanvasText; cursor: pointer; font: inherit; font-weight: 650; }
  .reader-card button:hover { background: color-mix(in srgb, CanvasText 6%, Canvas); }
  .reader-card button[aria-pressed="true"] { border-color: color-mix(in srgb, #2563eb 48%, Canvas); color: #2563eb; }
  .reader-actions form { margin: 0; }
  .reader-action-button { flex: 0 0 auto; white-space: nowrap; }
  .reader-post-like { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: .8rem; padding: 1rem 1.2rem; }
  .reader-count { color: GrayText; font-size: .92rem; }
  @media (max-width: 34rem) { .reader-author { align-items: flex-start; flex-wrap: wrap; } .reader-author .reader-action-button { width: 100%; } }
`;

function hiddenCsrf(token: string) {
  return h('input', { type: 'hidden', name: 'csrfmiddlewaretoken', value: token });
}

function hiddenReturnTo(returnTo: string) {
  return h('input', { type: 'hidden', name: 'return_to', value: returnTo });
}

function authorPath(username: string): string {
  return `/@${encodeURIComponent(username)}`;
}

function socialLabel(name: string): string {
  const normalized = name.toLowerCase();
  if (normalized === 'twitter' || normalized === 'x') return 'X';
  if (normalized === 'github') return 'GitHub';
  if (normalized === 'linkedin') return 'LinkedIn';
  return name || '링크';
}

function commentsModel(view: ReaderPostView, csrfToken: string, postPath: string): PostCommentsModel {
  return {
    slug: view.slug,
    postPath,
    isLoggedIn: view.viewerAuthenticated,
    canComment: view.canComment,
    csrfToken,
    comments: view.comments,
  };
}

function defaultPostPath(view: ReaderPostView): string {
  return `/@${encodeURIComponent(view.author.username)}/${encodeURIComponent(view.slug)}`;
}

export function AuthorHeader(props: AuthorHeaderProps) {
  const author = props.author;
  const subscribeUrl = `/v1/users/@${encodeURIComponent(author.username)}/subscription`;
  const subscription = author.canSubscribe
    ? props.viewerAuthenticated
      ? h('form', { method: 'post', action: subscribeUrl },
        hiddenCsrf(props.csrfToken),
        hiddenReturnTo(props.returnTo),
        ...(author.isSubscribed ? [h('input', { key: 'action', type: 'hidden', name: 'action', value: 'unsubscribe' })] : []),
        h('button', {
          className: 'reader-action-button',
          type: 'submit',
          'aria-pressed': author.isSubscribed,
        }, author.isSubscribed ? '구독 중' : '구독'),
      )
      : h('a', { ...loginPromptProps(props.returnTo, 'subscribe'), className: 'reader-action-button', 'aria-label': `${author.username} 구독` }, '구독')
    : null;

  return h('section', { className: 'reader-card', 'aria-label': `${author.username} 작성자 정보` },
    author.cover ? h('img', { className: 'reader-author-cover', src: author.cover, alt: `${author.username}님의 커버`, loading: 'lazy' }) : null,
    h('div', { className: 'reader-author' },
      h('img', { className: 'reader-author-avatar', src: author.avatar, alt: '', loading: 'lazy' }),
      h('div', { className: 'reader-author-copy' },
        h('a', { className: 'reader-author-name', href: authorPath(author.username) }, author.name),
        author.bio ? h('p', { className: 'reader-author-bio' }, author.bio) : null,
        h('div', { className: 'reader-author-links' },
          author.homepage ? h('a', { href: author.homepage, target: '_blank', rel: 'noopener noreferrer' }, '홈페이지') : null,
          ...author.social.map((link) => h('a', {
            key: link.id,
            href: link.value,
            target: '_blank',
            rel: 'noopener noreferrer',
            title: socialLabel(link.name),
          }, socialLabel(link.name))),
        ),
      ),
      subscription,
    ),
  );
}

export function PostComments(props: ReaderActionsProps) {
  const model = commentsModel(props.view, props.csrfToken, props.returnTo ?? defaultPostPath(props.view));
  return h(Fragment, null,
    h('div', { 'data-blex-post-comments': '', 'data-model': JSON.stringify(model) }, h(PostCommentsApp, { model })),
    h('script', { type: 'module', src: '/assets/blex/comments.js', 'data-blex-page-module': 'comments' }),
  );
}

export function ReaderActions(props: ReaderActionsProps) {
  const { view } = props;
  const returnTo = props.returnTo ?? defaultPostPath(view);
  const like = view.postLike.canLike
    ? h('form', { method: 'post', action: `/like/${encodeURIComponent(view.slug)}` },
      hiddenCsrf(props.csrfToken), hiddenReturnTo(returnTo),
      h('button', { type: 'submit', 'aria-pressed': view.postLike.isLiked }, `${view.postLike.isLiked ? '좋아요 취소' : '좋아요'} · ${view.postLike.countLikes}`),
    )
    : h('a', loginPromptProps(returnTo, 'like'), `좋아요 · ${view.postLike.countLikes}`);

  return h('div', { className: 'reader-actions' },
    h('style', null, styles),
    h(AuthorHeader, {
      author: view.author,
      viewerAuthenticated: view.viewerAuthenticated,
      csrfToken: props.csrfToken,
      returnTo,
    }),
    h('section', { className: 'reader-card reader-post-like', 'aria-label': '글 공감' },
      h('span', { className: 'reader-count' }, `${view.postLike.countLikes}명이 이 글에 공감했습니다.`),
      like,
    ),
    h(PostCommentsApp, { model: commentsModel(view, props.csrfToken, returnTo) }),
  );
}
