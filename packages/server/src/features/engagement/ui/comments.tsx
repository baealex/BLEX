import { SiteIcon, type SiteIconName } from '../../../appearance/icons.js';
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type RefObject } from 'react';
import type { CommentPayload } from '../index.js';
import {
  appendCommentToTree, buildReplySubmissionText, commentAuthors, countComments, findRootParentId,
  isMentionQuery, isMentionStart, mergeCommentInTree, updateCommentInTree,
} from './comment-model.js';
import { loginPromptProps } from './login-prompt.js';

export interface PostCommentsModel {
  slug: string;
  postPath: string;
  isLoggedIn: boolean;
  canComment: boolean;
  csrfToken: string;
  comments: CommentPayload[];
}

interface CommentHandlers {
  model: PostCommentsModel;
  hydrated: boolean;
  isSubmitting: boolean;
  editingId: number | null;
  editText: string;
  replyingId: number | null;
  replyText: string;
  mentionableUsers: string[];
  canComment: boolean;
  onLike: (id: number) => void;
  onEdit: (id: number) => void;
  onDelete: (id: number) => void;
  onEditText: (text: string) => void;
  onSaveEdit: (id: number) => void;
  onCancelEdit: () => void;
  onReply: (id: number) => void;
  onReplyText: (text: string) => void;
  onSaveReply: () => void;
  onCancelReply: () => void;
}

const fieldClass = 'w-full resize-none rounded-xl border border-line bg-surface p-5 text-sm leading-relaxed placeholder-content-hint transition-all duration-150 focus:border-line-strong focus:outline-none focus:ring-2 focus:ring-line/10';
const primaryButton = 'rounded-lg bg-action px-6 py-2.5 text-sm font-semibold text-content-inverted shadow-sm transition-all duration-150 hover:bg-action-hover hover:shadow-md disabled:cursor-not-allowed disabled:bg-line disabled:text-content-hint';
const secondaryButton = 'rounded-lg px-5 py-2.5 text-sm font-semibold text-content transition-all duration-150 hover:bg-surface-subtle disabled:opacity-50';
const actionButton = 'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors duration-150';
const quietAction = 'text-content-secondary hover:bg-surface-subtle hover:text-content';

const icons = {
  heart: 'heart', reply: 'arrow-back-up', lock: 'lock', more: 'dots-vertical', comment: 'message-dots',
} as const satisfies Record<string, SiteIconName>;

function Icon({ name, className }: { name: keyof typeof icons; className: string }) {
  return <SiteIcon name={icons[name]} className={className} />;
}

function readCsrfToken(fallback: string): string {
  const cookie = document.cookie.split('; ').find((part) => part.startsWith('csrftoken='))?.slice('csrftoken='.length);
  return cookie ? decodeURIComponent(cookie) : fallback;
}

async function requestComments<T>(model: PostCommentsModel, url: string, method: string, fields?: Record<string, string>): Promise<T> {
  const response = await fetch(url, {
    method,
    cache: 'no-store',
    credentials: 'same-origin',
    headers: {
      accept: 'application/json',
      ...(method === 'GET' ? {} : { 'x-csrftoken': readCsrfToken(model.csrfToken) }),
      ...(fields ? { 'content-type': 'application/x-www-form-urlencoded' } : {}),
    },
    body: fields ? new URLSearchParams(fields) : undefined,
  });
  const result = await response.json().catch(() => null) as { status?: string; body?: T } | null;
  if (!response.ok || result?.status !== 'DONE') throw new Error('The comment request failed.');
  return result.body as T;
}

function useAutoGrow(ref: RefObject<HTMLTextAreaElement | null>, value: string) {
  useEffect(() => {
    const field = ref.current;
    if (!field) return;
    field.style.height = 'auto';
    field.style.height = `${field.scrollHeight}px`;
  }, [ref, value]);
}

function CommentForm({
  value, onChange, onSubmit, isSubmitting, hydrated, mentionableUsers, onCancel, fieldRef, focusOnMount = false, nativeForm,
  placeholder = '댓글을 작성하세요...', submitLabel = '댓글 작성', submittingLabel = '작성 중...', fieldLabel = '댓글 내용',
}: {
  value: string;
  onChange: (text: string) => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  hydrated: boolean;
  mentionableUsers: string[];
  onCancel?: () => void;
  fieldRef?: RefObject<HTMLTextAreaElement | null>;
  focusOnMount?: boolean;
  nativeForm?: { action: string; csrfToken: string; returnTo: string };
  placeholder?: string;
  submitLabel?: string;
  submittingLabel?: string;
  fieldLabel?: string;
}) {
  const ownRef = useRef<HTMLTextAreaElement>(null);
  const textarea = fieldRef ?? ownRef;
  const listRef = useRef<HTMLDivElement>(null);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionStart, setMentionStart] = useState(0);
  const [selected, setSelected] = useState(0);
  useAutoGrow(textarea, value);
  useEffect(() => { if (focusOnMount) textarea.current?.focus(); }, [focusOnMount, textarea]);
  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${selected}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [selected]);

  const query = mentionQuery.toLowerCase();
  const users = query ? mentionableUsers.filter((user) => user.toLowerCase().includes(query)) : mentionableUsers;
  const showMentions = mentionOpen && users.length > 0;

  const handleChange = (text: string, cursor: number) => {
    onChange(text);
    const before = text.slice(0, cursor);
    const at = before.lastIndexOf('@');
    if (at !== -1 && isMentionStart(before, at) && isMentionQuery(before.slice(at + 1))) {
      setMentionQuery(before.slice(at + 1));
      setMentionStart(at);
      setMentionOpen(true);
      setSelected(0);
    } else setMentionOpen(false);
  };
  const selectUser = (username: string) => {
    const before = value.slice(0, mentionStart);
    const after = value.slice(textarea.current?.selectionStart ?? value.length);
    onChange(`${before}@${username} ${after}`);
    setMentionOpen(false);
    setTimeout(() => {
      const cursor = before.length + username.length + 2;
      textarea.current?.setSelectionRange(cursor, cursor);
      textarea.current?.focus();
    }, 0);
  };
  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!showMentions || event.nativeEvent.isComposing) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setSelected((index) => index < users.length - 1 ? index + 1 : 0);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setSelected((index) => index > 0 ? index - 1 : users.length - 1);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      selectUser(users[selected]);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setMentionOpen(false);
    }
  };
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isSubmitting && value.trim()) onSubmit();
  };

  return <form className="space-y-3" method="post" action={nativeForm?.action} onSubmit={handleSubmit}>
    {nativeForm && <>
      <input type="hidden" name="csrfmiddlewaretoken" value={nativeForm.csrfToken} />
      <input type="hidden" name="returnTo" value={nativeForm.returnTo} />
    </>}
    <div className="relative">
      <textarea ref={textarea} name="commentMd" className={fieldClass} value={value} rows={3} maxLength={10000} required
        placeholder={placeholder} aria-label={fieldLabel} disabled={isSubmitting}
        onChange={(event) => handleChange(event.target.value, event.target.selectionStart)}
        onKeyDown={handleKeyDown} onBlur={() => setMentionOpen(false)} />
      {showMentions && <div ref={listRef} role="listbox" aria-label="멘션할 사용자"
        className="absolute left-0 top-full z-50 mt-1 max-h-[200px] w-60 overflow-y-auto rounded-lg border border-line bg-surface shadow-lg">
        {users.map((user, index) => <button key={user} type="button" role="option" aria-selected={index === selected} data-index={index}
          onMouseDown={(event) => event.preventDefault()} onClick={() => selectUser(user)} onMouseEnter={() => setSelected(index)}
          className={`w-full px-4 py-2 text-left text-sm transition-colors ${index === selected ? 'bg-mention-surface text-mention-content' : 'text-content hover:bg-surface-subtle'}`}>
          <span className="font-medium">{`@${user}`}</span>
        </button>)}
      </div>}
    </div>
    <div className="flex justify-end gap-2">
      {onCancel && <button type="button" className={secondaryButton} onClick={onCancel} disabled={isSubmitting}>취소</button>}
      <button type="submit" className={primaryButton} disabled={hydrated && (isSubmitting || !value.trim())}>
        {isSubmitting ? submittingLabel : submitLabel}
      </button>
    </div>
  </form>;
}

function CommentEditForm({ value, onChange, onSave, onCancel, isSubmitting }: {
  value: string; onChange: (text: string) => void; onSave: () => void; onCancel: () => void; isSubmitting: boolean;
}) {
  const field = useRef<HTMLTextAreaElement>(null);
  useAutoGrow(field, value);
  useEffect(() => { field.current?.focus(); }, []);
  return <div className="space-y-3 rounded-xl border border-line bg-surface-subtle p-4">
    <textarea ref={field} className={fieldClass} value={value} rows={3} maxLength={10000} placeholder="댓글을 수정하세요..."
      aria-label="수정할 댓글 내용" disabled={isSubmitting} onChange={(event) => onChange(event.target.value)} />
    <div className="flex justify-end gap-2">
      <button type="button" className={secondaryButton} onClick={onCancel} disabled={isSubmitting} aria-label="댓글 수정 취소">취소</button>
      <button type="button" className={primaryButton} onClick={onSave} disabled={isSubmitting || !value.trim()} aria-label="댓글 저장">
        {isSubmitting ? '저장 중...' : '저장'}
      </button>
    </div>
  </div>;
}

function CommentMenu({ canEdit, canDelete, onEdit, onDelete }: {
  canEdit: boolean; canDelete: boolean; onEdit: () => void; onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: MouseEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    const closeOnEscape = (event: globalThis.KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', closeOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);
  const item = 'block w-full px-4 py-2 text-left text-sm transition-colors hover:bg-surface-subtle';
  return <div ref={root} className="absolute right-4 top-4 z-10">
    <button type="button" aria-label="댓글 옵션 열기" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((value) => !value)}
      className="inline-flex size-8 items-center justify-center rounded-md text-content-secondary transition-colors duration-150 hover:bg-surface-subtle hover:text-content">
      <Icon name="more" className="size-4" />
    </button>
    {open && <div role="menu" className="absolute right-0 mt-1 w-32 overflow-hidden rounded-lg border border-line bg-surface py-1 shadow-lg">
      {canEdit && <button type="button" role="menuitem" className={`${item} text-content`} onClick={() => { setOpen(false); onEdit(); }}>수정</button>}
      {canDelete && <button type="button" role="menuitem" className={`${item} text-danger`} onClick={() => { setOpen(false); onDelete(); }}>삭제</button>}
    </div>}
  </div>;
}

function CommentHeader({ comment }: { comment: CommentPayload }) {
  const name = comment.isDeleted ? '삭제된 사용자' : comment.author;
  const profile = `/@${encodeURIComponent(comment.author)}`;
  const avatarClass = 'size-11 rounded-full ring-2 ring-line-light transition-all duration-200 group-hover/avatar:ring-line';
  const avatar = comment.authorImage
    ? <img src={comment.authorImage} alt={`${name}님의 프로필 이미지`} loading="lazy" className={`${avatarClass} object-cover`} />
    : <div className={`${avatarClass} flex items-center justify-center bg-action text-sm font-semibold text-content-inverted`}>{name.charAt(0).toUpperCase()}</div>;
  return <div className="flex items-center gap-3">
    {comment.isDeleted
      ? <div className="group/avatar shrink-0">{avatar}</div>
      : <a href={profile} aria-label={`${comment.author}님의 프로필 보기`} className="group/avatar shrink-0 transition-transform duration-200 hover:scale-105">{avatar}</a>}
    <div className="flex min-h-11 min-w-0 flex-1 flex-col justify-center">
      {comment.isDeleted
        ? <span className="truncate text-sm font-semibold leading-5 text-content">{name}</span>
        : <a href={profile} className="truncate text-sm font-semibold leading-5 text-content transition-colors duration-150">{comment.author}</a>}
      <div className="mt-0.5 flex items-center gap-1.5 text-xs font-medium leading-4 text-content-secondary">
        <span>{comment.createdDate}</span>
        {comment.isEdited && <><span aria-hidden="true">·</span><span>수정됨</span></>}
      </div>
    </div>
  </div>;
}

function CommentActions({ comment, handlers }: { comment: CommentPayload; handlers: CommentHandlers }) {
  const { model, canComment } = handlers;
  const { permissions, isDeleted, isLiked, countLikes, id } = comment;
  const showLike = !isDeleted && (permissions.canLike || !model.isLoggedIn);
  const showCount = !isDeleted && !showLike && countLikes > 0;
  const showReply = !isDeleted && canComment && (permissions.canReply || !model.isLoggedIn);
  if (!showLike && !showCount && !showReply) return null;
  const likeContent = <><Icon name="heart" className={`size-4 ${isLiked ? 'fill-danger' : ''}`} />{countLikes > 0 && <span>{countLikes}</span>}</>;
  const likeClass = `${actionButton} ${isLiked ? 'bg-danger-surface text-danger ring-1 ring-danger-line' : quietAction}`;
  const replyContent = <><Icon name="reply" className="size-4" />답글</>;
  return <div className="mt-4 flex flex-wrap items-center gap-1">
    {showLike && (model.isLoggedIn
      ? <button type="button" className={likeClass} aria-label={isLiked ? '좋아요 취소' : '좋아요'} aria-pressed={isLiked} onClick={() => handlers.onLike(id)}>{likeContent}</button>
      : <a {...loginPromptProps(`${model.postPath}#comment-${id}`, 'like')} className={likeClass} aria-label="좋아요">{likeContent}</a>)}
    {showCount && <span className={`${actionButton} text-content-secondary`} aria-label={`좋아요 ${countLikes}개`}><Icon name="heart" className="size-4" /><span>{countLikes}</span></span>}
    {showReply && (model.isLoggedIn
      ? <button type="button" className={`${actionButton} ${quietAction}`} aria-label="답글 작성" onClick={() => handlers.onReply(id)}>{replyContent}</button>
      : <a {...loginPromptProps(`${model.postPath}?reply_to=${id}#post-comments`, 'reply')} className={`${actionButton} ${quietAction}`} aria-label="답글 작성">{replyContent}</a>)}
  </div>;
}

function CommentItem({ comment, handlers }: { comment: CommentPayload; handlers: CommentHandlers }) {
  const isEditing = handlers.editingId === comment.id;
  const isReply = comment.parentId !== undefined;
  const name = comment.isDeleted ? '삭제된 사용자' : comment.author;
  const { canEdit, canDelete } = comment.permissions;
  return <div className="group scroll-mt-24" id={`comment-${comment.id}`} data-comment-id={comment.id} role={isReply ? undefined : 'listitem'}>
    <article className={`relative py-6 transition-colors duration-200 ${isReply ? 'ml-6 border-l border-line-light pl-6 sm:ml-14 sm:pl-8' : ''}`}
      aria-label={isReply ? `${name}님의 답글` : `${name}님의 댓글`}>
      {(canEdit || canDelete) && !isEditing && <CommentMenu canEdit={canEdit} canDelete={canDelete}
        onEdit={() => handlers.onEdit(comment.id)} onDelete={() => handlers.onDelete(comment.id)} />}
      <CommentHeader comment={comment} />
      <div className="ml-0 mt-2 sm:ml-14">
        {isEditing
          ? <CommentEditForm value={handlers.editText} onChange={handlers.onEditText} onSave={() => handlers.onSaveEdit(comment.id)}
            onCancel={handlers.onCancelEdit} isSubmitting={handlers.isSubmitting} />
          : <>
            <div className="comment-content" dangerouslySetInnerHTML={{ __html: comment.renderedContent }} />
            <CommentActions comment={comment} handlers={handlers} />
          </>}
      </div>
    </article>
    {handlers.replyingId === comment.id && <div className="ml-6 mt-4 border-l border-line-light pl-6 pt-4 sm:ml-14 sm:pl-8">
      <div className="mb-3 flex items-center gap-2">
        <Icon name="reply" className="size-4 text-content-hint" />
        <p className="text-sm text-content-secondary">{`${comment.author}님에게 답글 작성 중`}</p>
      </div>
      <CommentForm focusOnMount value={handlers.replyText} onChange={handlers.onReplyText} onSubmit={handlers.onSaveReply}
        isSubmitting={handlers.isSubmitting} hydrated={handlers.hydrated} mentionableUsers={handlers.mentionableUsers}
        onCancel={handlers.onCancelReply} placeholder="답글을 작성하세요..." submitLabel="답글 작성" fieldLabel="답글 내용" />
    </div>}
    {!isReply && Boolean(comment.replies?.length) && <div className="mt-2">
      {comment.replies?.map((reply) => <CommentItem key={reply.id} comment={reply} handlers={handlers} />)}
    </div>}
  </div>;
}

export function PostCommentsApp({ model }: { model: PostCommentsModel }) {
  const [comments, setComments] = useState(model.comments);
  const [canComment, setCanComment] = useState(model.canComment);
  const [hydrated, setHydrated] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [isSubmitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState('');
  const [replyTargetId, setReplyTargetId] = useState<number | null>(null);
  const [replyText, setReplyText] = useState('');
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const mainField = useRef<HTMLTextAreaElement>(null);
  const deleteDialog = useRef<HTMLDialogElement>(null);
  const commentsUrl = `/v1/comments?url=${encodeURIComponent(model.slug)}`;
  const replyRootId = replyTargetId !== null && canComment ? findRootParentId(replyTargetId, comments) : null;
  const replyRoot = comments.find((comment) => comment.id === replyRootId);
  const replyTarget = replyRoot?.id === replyTargetId ? replyRoot : replyRoot?.replies?.find((reply) => reply.id === replyTargetId);
  const canReply = Boolean(replyTarget?.permissions.canReply);

  useEffect(() => {
    setHydrated(true);
    if (!model.isLoggedIn || window.location.hash !== '#post-comments') return;
    const replyTo = Number(new URLSearchParams(window.location.search).get('reply_to'));
    if (Number.isSafeInteger(replyTo) && replyTo > 0) setReplyTargetId(replyTo);
    else mainField.current?.focus();
  }, [model.isLoggedIn]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 3000);
    return () => clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    const dialog = deleteDialog.current;
    if (deleteId !== null && dialog && !dialog.open) dialog.showModal();
    if (deleteId === null && dialog?.open) dialog.close();
  }, [deleteId]);

  const success = (text: string) => setNotice({ text, error: false });
  const failure = (text: string) => setNotice({ text, error: true });
  const scrollToLatest = () => setTimeout(() => {
    const rendered = listRef.current?.querySelectorAll('[data-comment-id]');
    rendered?.[rendered.length - 1]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 300);

  const handleWrite = async () => {
    setSubmitting(true);
    try {
      const created = await requestComments<CommentPayload>(model, commentsUrl, 'POST', { commentMd: commentText });
      setCommentText('');
      setComments((current) => appendCommentToTree(current, created));
      scrollToLatest();
      success('댓글을 작성했습니다.');
    } catch {
      failure('댓글을 작성하는 중 문제가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  };
  const handleLike = async (id: number) => {
    try {
      const state = await requestComments<{ isLiked: boolean; countLikes: number }>(model, `/v1/comments/${id}`, 'PUT', { like: 'like' });
      setComments((current) => updateCommentInTree(current, id, (comment) => ({ ...comment, ...state })));
    } catch {
      failure('좋아요를 변경하는 중 문제가 발생했습니다.');
    }
  };
  const startEditing = async (id: number) => {
    try {
      const { textMd } = await requestComments<{ textMd: string }>(model, `/v1/comments/${id}`, 'GET');
      setEditingId(id);
      setEditText(textMd);
    } catch {
      failure('댓글을 불러오는 중 문제가 발생했습니다.');
    }
  };
  const cancelEditing = () => { setEditingId(null); setEditText(''); };
  const saveEdit = async (id: number) => {
    if (!editText.trim()) return failure('댓글을 입력해 주세요.');
    setSubmitting(true);
    try {
      await requestComments(model, `/v1/comments/${id}`, 'PUT', { comment: 'true', commentMd: editText });
      const latest = await requestComments<{ comments: CommentPayload[]; canComment: boolean }>(
        model, `/v1/posts/${encodeURIComponent(model.slug)}/comments`, 'GET');
      setComments(latest.comments);
      setCanComment(latest.canComment);
      cancelEditing();
      success('댓글을 수정했습니다.');
    } catch {
      failure('댓글을 수정하는 중 문제가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  };
  const confirmDelete = async () => {
    const id = deleteId;
    setDeleteId(null);
    if (id === null) return;
    try {
      const deleted = await requestComments<CommentPayload>(model, `/v1/comments/${id}`, 'DELETE');
      setComments((current) => mergeCommentInTree(current, deleted));
      success('댓글을 삭제했습니다.');
    } catch {
      failure('댓글을 삭제하는 중 문제가 발생했습니다.');
    }
  };
  const cancelReplying = () => { setReplyTargetId(null); setReplyText(''); };
  const handleReply = async () => {
    if (!replyRoot || !replyTarget || !canReply) return failure('답글을 남길 댓글을 찾지 못했습니다.');
    setSubmitting(true);
    try {
      const created = await requestComments<CommentPayload>(model, commentsUrl, 'POST', {
        commentMd: buildReplySubmissionText(replyText, replyTarget.author), parentId: String(replyRoot.id),
      });
      cancelReplying();
      setComments((current) => appendCommentToTree(current, created));
      scrollToLatest();
      success('답글을 작성했습니다.');
    } catch {
      failure('답글을 작성하는 중 문제가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const mentionableUsers = commentAuthors(comments);
  const handlers: CommentHandlers = {
    model, hydrated, isSubmitting, editingId, editText, replyingId: canReply ? replyTargetId : null, replyText, mentionableUsers, canComment,
    onLike: (id) => void handleLike(id),
    onEdit: (id) => void startEditing(id),
    onDelete: setDeleteId,
    onEditText: setEditText,
    onSaveEdit: (id) => void saveEdit(id),
    onCancelEdit: cancelEditing,
    onReply: (id) => { setReplyTargetId(id); setReplyText(''); },
    onReplyText: setReplyText,
    onSaveReply: () => void handleReply(),
    onCancelReply: cancelReplying,
  };

  return <section id="post-comments" className="my-16 scroll-mt-24 rounded-2xl bg-surface p-6 ring-1 ring-line/60 sm:p-8" aria-labelledby="comments-heading">
    <div className="mb-6 flex items-start justify-between gap-4 border-b border-line-light pb-4">
      <h2 id="comments-heading" className="min-w-0 text-lg font-bold leading-snug text-content">댓글</h2>
      <span className="shrink-0 text-sm font-medium leading-6 text-content-secondary">{`댓글 ${countComments(comments)}개`}</span>
    </div>
    <div ref={listRef}>
      {comments.length
        ? <div className="divide-y divide-line-light" role="list">{comments.map((comment) => <CommentItem key={comment.id} comment={comment} handlers={handlers} />)}</div>
        : <div className="py-8 text-center">
          <Icon name="comment" className="mx-auto mb-2 size-8 text-content-hint" />
          <p className="text-sm text-content-secondary">아직 댓글이 없습니다</p>
        </div>}
    </div>
    {canComment
      ? <div className="mt-8 border-t border-line-light pt-8">
        <h3 className="mb-6 text-sm font-medium text-content-secondary">댓글 남기기</h3>
        {model.isLoggedIn
          ? <CommentForm fieldRef={mainField} value={commentText} onChange={setCommentText} onSubmit={() => void handleWrite()} isSubmitting={isSubmitting}
            hydrated={hydrated} mentionableUsers={mentionableUsers}
            nativeForm={{ action: commentsUrl, csrfToken: model.csrfToken, returnTo: model.postPath }} />
          : <a {...loginPromptProps(`${model.postPath}#post-comments`, 'comment')} aria-label="로그인하고 댓글 작성"
            className="group flex min-h-28 w-full cursor-pointer flex-col items-start justify-between gap-4 rounded-xl border border-line bg-surface-subtle p-5 text-left transition-all duration-150 hover:border-line-strong hover:bg-surface focus:outline-none focus:ring-2 focus:ring-action/20">
            <span aria-hidden="true" className="text-sm text-content-hint">댓글을 작성하세요...</span>
            <span className="inline-flex items-center gap-2 text-sm font-semibold text-content-secondary transition-colors group-hover:text-content">
              <Icon name="lock" className="size-4" />로그인하고 댓글 작성
            </span>
          </a>}
      </div>
      : <div className="mt-8 flex items-center gap-3 rounded-xl border border-line bg-surface-subtle px-4 py-3 text-content-secondary">
        <Icon name="comment" className="size-4 shrink-0 text-content-hint" />
        <p className="text-sm">작성자가 이 글의 새 댓글과 답글을 받지 않습니다.</p>
      </div>}
    <dialog ref={deleteDialog} aria-labelledby="comment-delete-title" onClose={() => setDeleteId(null)}
      onClick={(event) => { if (event.target === event.currentTarget) setDeleteId(null); }}
      className="fixed inset-0 m-auto h-fit w-[calc(100%-2rem)] max-w-sm rounded-2xl border border-line bg-surface p-6 text-content shadow-xl backdrop:bg-black/50">
      <h2 id="comment-delete-title" className="mb-2 text-lg font-semibold">댓글 삭제</h2>
      <p className="mb-6 text-sm text-content-secondary">이 댓글을 삭제할까요?</p>
      <div className="flex justify-end gap-2">
        <button type="button" className={secondaryButton} onClick={() => setDeleteId(null)}>취소</button>
        <button type="button" onClick={() => void confirmDelete()}
          className="rounded-lg bg-danger px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90">삭제</button>
      </div>
    </dialog>
    {notice && <p role={notice.error ? 'alert' : 'status'} className={`fixed bottom-28 left-1/2 z-50 max-w-[calc(100%-2rem)] -translate-x-1/2 rounded-lg border px-4 py-2.5 text-sm font-medium shadow-lg ${notice.error ? 'border-danger-line bg-danger-surface text-danger' : 'border-line bg-surface text-content'}`}>{notice.text}</p>}
  </section>;
}
