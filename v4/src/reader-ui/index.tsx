import { createElement } from 'react';
import type { ReactNode } from 'react';
import type { CommentPayload, ReaderAuthorHeader, ReaderPostView } from '../reader-actions/index.js';
import { SiteIcon } from '../appearance/shell.js';

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
  .reader-actions button, .reader-actions input, .reader-actions textarea { font: inherit; }
  .reader-actions button { min-height: 2.5rem; padding: .45rem .8rem; border: 1px solid color-mix(in srgb, CanvasText 22%, Canvas); border-radius: .65rem; background: Canvas; color: CanvasText; cursor: pointer; font-weight: 650; }
  .reader-actions button:hover { background: color-mix(in srgb, CanvasText 6%, Canvas); }
  .reader-actions button[aria-pressed="true"] { border-color: color-mix(in srgb, #2563eb 48%, Canvas); color: #2563eb; }
  .reader-actions form { margin: 0; }
  .reader-action-button { flex: 0 0 auto; white-space: nowrap; }
  .reader-post-like { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: .8rem; padding: 1rem 1.2rem; }
  .reader-count { color: GrayText; font-size: .92rem; }
  .reader-comments { padding: 1.2rem; }
  .reader-comments-header { display: flex; align-items: baseline; justify-content: space-between; gap: .75rem; border-bottom: 1px solid color-mix(in srgb, CanvasText 15%, Canvas); padding-bottom: .7rem; }
  .reader-comments h2 { margin: 0; font-size: 1.25rem; }
  .reader-comment-list { display: grid; gap: 1rem; margin: 1.1rem 0 1.6rem; }
  .reader-comment { min-width: 0; padding: .85rem; border: 1px solid color-mix(in srgb, CanvasText 12%, Canvas); border-radius: .8rem; background: color-mix(in srgb, Canvas 98%, CanvasText); }
  .reader-comment-head { display: flex; align-items: center; gap: .6rem; min-width: 0; }
  .reader-comment-avatar { width: 2rem; height: 2rem; object-fit: cover; border-radius: 50%; background: color-mix(in srgb, CanvasText 8%, Canvas); }
  .reader-comment-author { font-weight: 700; text-decoration: none; }
  .reader-comment-date, .reader-comment-edited { color: GrayText; font-size: .8rem; }
  .reader-comment-body { overflow-wrap: anywhere; line-height: 1.7; }
  .reader-comment-body > :first-child { margin-top: .55rem; }
  .reader-comment-body > :last-child { margin-bottom: .3rem; }
  .reader-comment-body img, .reader-comment-body video { max-width: 100%; height: auto; }
  .reader-comment-actions { display: flex; flex-wrap: wrap; align-items: center; gap: .5rem .75rem; margin-top: .7rem; }
  .reader-comment-actions button { min-height: 2rem; padding: .25rem .6rem; font-size: .84rem; }
  .reader-comment-actions a { font-size: .84rem; }
  .reader-replies { display: grid; gap: .7rem; margin: .8rem 0 0 1rem; padding-left: .8rem; border-left: 2px solid color-mix(in srgb, CanvasText 14%, Canvas); }
  .reader-form { border-top: 1px solid color-mix(in srgb, CanvasText 15%, Canvas); padding-top: 1.1rem; }
  .reader-form label { display: block; font-size: .9rem; font-weight: 700; margin-bottom: .35rem; }
  .reader-form textarea { width: 100%; min-height: 6rem; padding: .65rem .75rem; resize: vertical; border: 1px solid color-mix(in srgb, CanvasText 22%, Canvas); border-radius: .7rem; color: CanvasText; background: Canvas; }
  .reader-form button { margin-top: .55rem; }
  .reader-muted { color: GrayText; }
  @media (max-width: 34rem) { .reader-author { align-items: flex-start; flex-wrap: wrap; } .reader-author .reader-action-button { width: 100%; } .reader-replies { margin-left: .35rem; padding-left: .55rem; } }
`;

function hiddenCsrf(token: string) {
  return h('input', { type: 'hidden', name: 'csrfmiddlewaretoken', value: token });
}

function hiddenReturnTo(returnTo: string) {
  return h('input', { type: 'hidden', name: 'return_to', value: returnTo });
}

function loginHref(returnTo: string, action?: string): string {
  const url = new URL(returnTo, 'https://blex.local');
  if (action) url.searchParams.set('action', action);
  return `/login?next=${encodeURIComponent(`${url.pathname}${url.search}${url.hash}`)}`;
}

function countComments(comments: CommentPayload[]): number {
  return comments.reduce((total, comment) => total + 1 + countComments(comment.replies ?? []), 0);
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
        }, author.isSubscribed ? '구독 중 · 취소' : '새 글 구독'),
      )
      : h('a', { className: 'reader-action-button', href: loginHref(props.returnTo, 'subscribe') }, '로그인하고 구독')
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

function commentReplyForm(comment: CommentPayload, props: ReaderActionsProps, returnTo: string) {
  if (!props.view.canComment || comment.isDeleted || comment.parentId !== undefined || !comment.permissions.canReply) return null;
  const postPath = `/v1/comments?url=${encodeURIComponent(props.view.slug)}`;
  return h('details', { className: 'blex-user-menu mt-2 text-sm' },
    h('summary', { className: 'w-fit cursor-pointer text-content-secondary hover:text-content' }, '답글'),
    h('form', { className: 'reader-form', method: 'post', action: postPath },
      hiddenCsrf(props.csrfToken), hiddenReturnTo(returnTo),
      h('input', { type: 'hidden', name: 'parent_id', value: comment.id }),
      h('label', { htmlFor: `reader-reply-${comment.id}` }, `${comment.author}님에게 답글`),
      h('textarea', { id: `reader-reply-${comment.id}`, name: 'comment_md', maxLength: 10000, required: true }),
      h('button', { type: 'submit' }, '답글 등록'),
    ),
  );
}

function commentNode(comment: CommentPayload, props: ReaderActionsProps, returnTo: string): ReactNode {
  const loginTarget = `${returnTo}#comment-${comment.id}`;
  const avatar = comment.authorImage
    ? h('img', { className: 'reader-comment-avatar', src: comment.authorImage, alt: '', loading: 'lazy' })
    : null;
  const author = comment.isDeleted
    ? h('span', { className: 'reader-comment-author' }, comment.author)
    : h('a', { className: 'reader-comment-author', href: authorPath(comment.author) }, comment.author);
  const likeAction = comment.permissions.canLike
    ? h('form', { method: 'post', action: `/v1/comments/${comment.id}` },
      hiddenCsrf(props.csrfToken), hiddenReturnTo(loginTarget),
      h('input', { type: 'hidden', name: 'like', value: 'like' }),
      h('button', { type: 'submit', 'aria-pressed': comment.isLiked }, `${comment.isLiked ? '공감 취소' : '공감'} · ${comment.countLikes}`),
    )
    : !props.view.viewerAuthenticated && !comment.isMine && !comment.isDeleted
      ? h('a', { href: loginHref(loginTarget, 'like') }, `공감 · ${comment.countLikes}`)
      : h('span', { className: 'reader-muted', 'aria-label': `공감 ${comment.countLikes}개` }, `공감 · ${comment.countLikes}`);
  const deleteAction = comment.permissions.canDelete
    ? h('form', { method: 'post', action: `/v1/comments/${comment.id}` },
      hiddenCsrf(props.csrfToken), hiddenReturnTo(returnTo),
      h('input', { type: 'hidden', name: 'action', value: 'delete' }),
      h('button', { type: 'submit', 'aria-label': `${comment.author} 댓글 삭제` }, '삭제'),
    )
    : null;
  const replyLogin = !props.view.viewerAuthenticated && props.view.canComment && !comment.isDeleted && comment.parentId === undefined
    ? h('a', { href: loginHref(`${returnTo}#comment-${comment.id}`, 'reply') }, '로그인하고 답글')
    : null;
  const replies = comment.replies ?? [];
  const edit = comment.permissions.canEdit ? h('details', { className: 'blex-user-menu mt-2 text-sm', 'data-comment-edit': comment.id },
    h('summary', { className: 'w-fit cursor-pointer text-content-secondary hover:text-content' }, '수정'),
    h('form', { className: 'reader-form', method: 'post', action: `/v1/comments/${comment.id}` },
      hiddenCsrf(props.csrfToken), hiddenReturnTo(returnTo),
      h('input', { type: 'hidden', name: 'action', value: 'edit' }),
      h('label', { htmlFor: `reader-edit-${comment.id}` }, '댓글 수정'),
      h('textarea', { id: `reader-edit-${comment.id}`, name: 'comment_md', maxLength: 10000, required: true, disabled: true }),
      h('button', { type: 'submit', disabled: true }, '수정 저장'),
      h('p', { role: 'status', 'data-comment-edit-status': '' }),
    ),
  ) : null;
  return h('article', { className: 'reader-comment py-6', id: `comment-${comment.id}`, key: comment.id },
    h('header', { className: 'reader-comment-head' },
      avatar,
      author,
      h('span', { className: 'reader-comment-date' }, comment.createdDate),
      comment.isEdited ? h('span', { className: 'reader-comment-edited' }, '수정됨') : null,
    ),
    h('div', { className: 'reader-comment-body comment-content', dangerouslySetInnerHTML: { __html: comment.renderedContent } }),
    h('div', { className: 'reader-comment-actions' }, likeAction, replyLogin, deleteAction),
    commentReplyForm(comment, props, `${returnTo}#comment-${comment.id}`),
    edit,
    replies.length ? h('div', { className: 'reader-replies' }, replies.map((reply) => commentNode(reply, props, returnTo))) : null,
  );
}

function commentsSection(props: ReaderActionsProps, returnTo: string) {
  const view = props.view;
  const commentsUrl = `/v1/comments?url=${encodeURIComponent(view.slug)}`;
  const commentForm = view.canComment
    ? view.viewerAuthenticated
      ? h('form', { className: 'reader-form', method: 'post', action: commentsUrl },
        hiddenCsrf(props.csrfToken), hiddenReturnTo(returnTo),
        h('label', { htmlFor: 'reader-new-comment' }, '댓글 남기기'),
        h('textarea', { id: 'reader-new-comment', name: 'comment_md', maxLength: 10000, placeholder: '댓글을 작성하세요…', required: true }),
        h('button', { type: 'submit' }, '댓글 등록'),
      )
      : h('div', { className: 'reader-form' },
        h('p', { className: 'mb-6 text-sm font-medium text-content-secondary' }, '댓글 남기기'),
        h('a', { className: 'flex min-h-12 items-center gap-2 rounded-xl border border-line bg-surface-subtle px-4 text-sm text-content-secondary hover:text-content', href: loginHref(`${returnTo}#post-comments`, 'comment') },
          h(SiteIcon, { name: 'comment' }), '로그인하고 댓글 남기기'))
    : h('p', { className: 'reader-form reader-muted' }, '작성자가 댓글과 답글을 받지 않고 있습니다.');

  return h('section', { className: 'reader-card reader-comments', id: 'post-comments', 'aria-labelledby': 'reader-comments-title' },
    h('header', { className: 'reader-comments-header' },
      h('h2', { id: 'reader-comments-title' }, '댓글'),
      h('span', { className: 'reader-count' }, `${countComments(view.comments)}개`),
    ),
    view.comments.length
      ? h('div', { className: 'reader-comment-list' }, view.comments.map((comment) => commentNode(comment, props, returnTo)))
      : h('div', { className: 'py-8 text-center' }, h(SiteIcon, { name: 'comment', className: 'mx-auto mb-2 size-8 text-content-hint' }),
        h('p', { className: 'text-sm text-content-secondary' }, '아직 댓글이 없습니다.')),
    commentForm,
  );
}

export function PostComments(props: ReaderActionsProps) {
  const returnTo = props.returnTo ?? `/@${encodeURIComponent(props.view.author.username)}/${encodeURIComponent(props.view.slug)}`;
  return h('div', { className: 'reader-actions post-comments-styled' }, h('style', null, styles), commentsSection(props, returnTo));
}

export function ReaderActions(props: ReaderActionsProps) {
  const { view } = props;
  const returnTo = props.returnTo ?? `/@${encodeURIComponent(view.author.username)}/${encodeURIComponent(view.slug)}`;
  const like = view.postLike.canLike
    ? h('form', { method: 'post', action: `/like/${encodeURIComponent(view.slug)}` },
      hiddenCsrf(props.csrfToken), hiddenReturnTo(returnTo),
      h('button', { type: 'submit', 'aria-pressed': view.postLike.isLiked }, `${view.postLike.isLiked ? '좋아요 취소' : '좋아요'} · ${view.postLike.countLikes}`),
    )
    : h('a', { href: loginHref(returnTo, 'like') }, `로그인하고 좋아요 · ${view.postLike.countLikes}`);

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
    commentsSection(props, returnTo),
  );
}
