import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './editor-tools.css';

const trackedFields = ['title', 'subtitle', 'text_md', 'content_type', 'url', 'tag', 'meta_description', 'series', 'reserved_date'] as const;
const lifetime = 86_400_000;
const pendingDraftKey = 'blex-editor:pending-draft';
const VisualEditor = lazy(() => import('./visual-editor.js'));

type Draft = { fields: Record<string, string>; savedAt: number };

async function uploadEditorImage(form: HTMLFormElement, file: File, signal?: AbortSignal): Promise<string> {
  const csrf = form.elements.namedItem('csrfmiddlewaretoken');
  if (!(csrf instanceof HTMLInputElement)) throw new Error('No CSRF token');
  const payload = new FormData();
  payload.append('csrfmiddlewaretoken', csrf.value);
  payload.append('image', file);
  const response = await fetch('/v1/image', {
    method: 'POST', signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(30_000)]) : AbortSignal.timeout(30_000), credentials: 'same-origin',
    headers: { 'X-CSRFToken': csrf.value }, body: payload,
  });
  const result = await response.json();
  if (!response.ok || result.status !== 'DONE' || typeof result.body?.url !== 'string') {
    throw new Error(typeof result.errorMessage === 'string' ? result.errorMessage : '이미지를 올리지 못했습니다.');
  }
  return result.body.url as string;
}

function fieldValues(form: HTMLFormElement) {
  const fields = new FormData(form);
  return Object.fromEntries(trackedFields.map((name) => [name, String(fields.get(name) ?? '')]));
}

function saveEditorRecovery(storageKey: string, form: HTMLFormElement): boolean {
  try {
    localStorage.setItem(storageKey, JSON.stringify({ fields: fieldValues(form), savedAt: Date.now() } satisfies Draft));
    return true;
  } catch {
    return false;
  }
}

function recoverableDraft(key: string, form: HTMLFormElement): Draft | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const saved = JSON.parse(raw) as Draft;
    if (!saved.fields || !saved.savedAt || Date.now() - saved.savedAt > lifetime) {
      localStorage.removeItem(key);
      return null;
    }
    const current = fieldValues(form);
    return trackedFields.some((field) => typeof saved.fields[field] === 'string' && saved.fields[field] !== current[field]) ? saved : null;
  } catch {
    return null;
  }
}

function clearSavedDraft(key: string) {
  try {
    const raw = sessionStorage.getItem(pendingDraftKey);
    sessionStorage.removeItem(pendingDraftKey);
    if (!raw) return;
    const pending = JSON.parse(raw) as Draft & { storageKey: string };
    if (Date.now() - pending.savedAt > 60_000 || pending.storageKey.slice(0, pending.storageKey.lastIndexOf(':')) !== key.slice(0, key.lastIndexOf(':'))) return;
    const saved = JSON.parse(localStorage.getItem(pending.storageKey) ?? 'null') as Draft | null;
    if (saved && pending.savedAt >= saved.savedAt && trackedFields.every((field) => pending.fields[field] === saved.fields[field])) {
      localStorage.removeItem(pending.storageKey);
    }
  } catch { /* Local recovery is optional when browser storage is unavailable. */ }
}

interface EditorProps { form: HTMLFormElement; body: HTMLTextAreaElement; storageKey: string }

function EditorTools({ form, body, storageKey }: EditorProps) {
  const uploadController = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  const [draft, setDraft] = useState(() => recoverableDraft(storageKey, form));
  const [status, setStatus] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [visualHtml, setVisualHtml] = useState<string | null>(null);
  const [openingVisual, setOpeningVisual] = useState(true);
  const visual = visualHtml !== null;

  useEffect(() => {
    let timer: number | undefined;
    let draftSubmission = false;
    const save = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        setStatus(saveEditorRecovery(storageKey, form)
          ? '이 브라우저에 복구본을 저장했습니다.'
          : '이 브라우저에 복구본을 저장할 수 없습니다.');
      }, 750);
    };
    const markDraftSubmission = (event: SubmitEvent) => {
      if (!(event.submitter instanceof HTMLButtonElement) || event.submitter.value !== 'draft') return;
      draftSubmission = true;
      const savedAt = Date.now();
      const draft = { fields: fieldValues(form), savedAt } satisfies Draft;
      try {
        localStorage.setItem(storageKey, JSON.stringify(draft));
        sessionStorage.setItem(pendingDraftKey, JSON.stringify({ ...draft, storageKey }));
      } catch { /* Local recovery is optional when browser storage is unavailable. */ }
    };
    form.addEventListener('input', save);
    form.addEventListener('change', save);
    form.addEventListener('submit', markDraftSubmission);
    return () => {
      form.removeEventListener('input', save);
      form.removeEventListener('change', save);
      form.removeEventListener('submit', markDraftSubmission);
      window.clearTimeout(timer);
      if (!draftSubmission) saveEditorRecovery(storageKey, form);
    };
  }, [form, storageKey]);

  useEffect(() => {
    const controller = new AbortController();
    uploadController.current = controller;
    mounted.current = true;
    return () => {
      mounted.current = false;
      controller.abort();
      if (uploadController.current === controller) uploadController.current = null;
    };
  }, []);

  useEffect(() => {
    const label = body.closest('label');
    if (!label || !visual) return;
    const required = body.required;
    label.hidden = true;
    body.required = false;
    return () => {
      label.hidden = false;
      body.required = required;
    };
  }, [body, visual]);

  const isHtmlMode = () => {
    const type = form.elements.namedItem('content_type');
    return (type instanceof HTMLInputElement || type instanceof HTMLSelectElement) && type.value === 'html';
  };

  const insert = (left: string, right = '', placeholder = '') => {
    const start = body.selectionStart;
    const end = body.selectionEnd;
    const selected = body.value.slice(start, end) || placeholder;
    body.focus();
    body.setRangeText(`${left}${selected}${right}`, start, end, 'end');
    body.setSelectionRange(start + left.length, start + left.length + selected.length);
    body.dispatchEvent(new Event('input', { bubbles: true }));
  };

  const restore = () => {
    if (!draft) return;
    setVisualHtml(null);
    for (const field of trackedFields) {
      const element = form.elements.namedItem(field);
      const stored = draft.fields[field];
      if ((element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) &&
          typeof stored === 'string') element.value = stored;
    }
    const heading = body.closest('label')?.querySelector('[data-editor-source-label]');
    if (heading) heading.textContent = isHtmlMode() ? '본문 소스' : '마크다운 본문';
    body.dispatchEvent(new Event('input', { bubbles: true }));
    setDraft(null);
    setStatus('복구본을 편집기에 불러왔습니다.');
  };

  const discard = () => {
    try { localStorage.removeItem(storageKey); } catch { /* Storage can be unavailable. */ }
    setDraft(null);
    setStatus('복구본을 지웠습니다.');
  };

  const renderedBody = async () => {
    if (!body.value.trim()) return '';
    const csrf = form.elements.namedItem('csrfmiddlewaretoken');
    if (!(csrf instanceof HTMLInputElement)) throw new Error('No CSRF token');
    const controller = uploadController.current;
    const signal = controller ? AbortSignal.any([controller.signal, AbortSignal.timeout(10_000)]) : AbortSignal.timeout(10_000);
    const result = await fetch('/v1/markdown', {
      method: 'POST', signal, credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrf.value },
      body: JSON.stringify({ text: body.value, source_type: isHtmlMode() ? 'html' : 'markdown' }),
    });
    const value = await result.json();
    if (!result.ok || value.status !== 'DONE' || typeof value.body?.html !== 'string') throw new Error('Preview unavailable');
    return value.body.html as string;
  };

  const uploadImage = async (file: File) => {
    const url = await uploadEditorImage(form, file, uploadController.current?.signal);
    if (mounted.current) setStatus('이미지를 올렸습니다.');
    return url;
  };

  useEffect(() => {
    let active = true;
    void renderedBody().then((html) => {
      if (active) setVisualHtml(html);
    }).catch(() => {
      if (active) setStatus('서식 편집기를 열지 못했습니다. 본문 소스로 계속 작성할 수 있습니다.');
    }).finally(() => {
      if (active) setOpeningVisual(false);
    });
    return () => { active = false; };
  }, []);

  const toggleVisual = async () => {
    if (visual) {
      setVisualHtml(null);
      return;
    }
    setOpeningVisual(true);
    try {
      const markup = await renderedBody();
      if (mounted.current) {
        setVisualHtml(markup);
        setPreview(null);
      }
    } catch {
      if (mounted.current) setStatus('서식 편집기를 열 수 없습니다. 본문을 확인하고 다시 시도해 주세요.');
    } finally {
      if (mounted.current) setOpeningVisual(false);
    }
  };

  const updateHtml = (markup: string) => {
    const type = form.elements.namedItem('content_type');
    if (type instanceof HTMLInputElement || type instanceof HTMLSelectElement) type.value = 'html';
    body.value = markup;
    const heading = body.closest('label')?.querySelector('[data-editor-source-label]');
    if (heading) heading.textContent = '본문 소스';
    body.dispatchEvent(new Event('input', { bubbles: true }));
  };

  const showPreview = async () => {
    if (preview !== null) {
      setPreview(null);
      return;
    }
    setPreviewing(true);
    try {
      const markup = await renderedBody();
      if (mounted.current) setPreview(markup);
    } catch {
      if (mounted.current) setStatus('미리보기를 불러오지 못했습니다. 본문을 확인하고 다시 시도해 주세요.');
    } finally {
      if (mounted.current) setPreviewing(false);
    }
  };

  useEffect(() => {
    const statusNode = form.querySelector<HTMLElement>('[data-editor-save-status]');
    if (statusNode && status) statusNode.textContent = status;
  }, [form, status]);

  useEffect(() => {
    const openPreview = () => { void showPreview(); };
    form.addEventListener('blex:editor-preview', openPreview);
    return () => form.removeEventListener('blex:editor-preview', openPreview);
  }, [form, preview, previewing]);

  return <div className="editor-tools">
    {draft && <div className="editor-recovery">
      <p>이 브라우저에 이전 복구본이 있습니다.</p>
      <button type="button" onClick={restore}>복구본 불러오기</button>
      <button type="button" onClick={discard}>복구본 지우기</button>
    </div>}
    <div className="editor-toolbar" role="group" aria-label="편집기 도구">
      <button type="button" aria-pressed={visual} disabled={openingVisual} onClick={toggleVisual}>{visual ? '소스로 편집' : '서식으로 편집'}</button>
      {!visual && <>
        <button type="button" onClick={() => isHtmlMode() ? insert('<strong>', '</strong>', '굵은 글씨') : insert('**', '**', '굵은 글씨')}>굵게</button>
        <button type="button" onClick={() => isHtmlMode() ? insert('<em>', '</em>', '기울임') : insert('*', '*', '기울임')}>기울임</button>
        <button type="button" onClick={() => isHtmlMode() ? insert('<h2>', '</h2>', '소제목') : insert('\n## ', '\n', '소제목')}>소제목</button>
        <button type="button" onClick={() => isHtmlMode() ? insert('<a href="https://">', '</a>', '링크 이름') : insert('[', '](https://)', '링크 이름')}>링크</button>
        <button type="button" onClick={() => isHtmlMode() ? insert('<code>', '</code>', '코드') : insert('`', '`', '코드')}>코드</button>
      </>}
      <a href="/write/images" target="_blank" rel="noopener noreferrer">이미지·동영상 올리기</a>
      <button type="button" disabled={previewing} onClick={showPreview}>{preview === null ? '미리보기' : '미리보기 닫기'}</button>
    </div>
    {openingVisual && <p role="status" className="editor-local-status">서식 편집기를 여는 중입니다.</p>}
    {visualHtml !== null && <Suspense fallback={<p role="status">서식 편집기를 불러오는 중입니다.</p>}>
      <VisualEditor initialHtml={visualHtml} onEdit={updateHtml} onImageUpload={uploadImage} />
    </Suspense>}
    <p role="status" aria-live="polite" className="editor-local-status">{status}</p>
    <div className="editor-preview-dialog" role="dialog" aria-modal="true" aria-labelledby="editor-preview-title" hidden={preview === null}>
      <section className="editor-preview-panel">
        <header><h2 id="editor-preview-title">포스트 미리보기</h2>
          <button type="button" className="editor-icon-button" onClick={() => setPreview(null)} aria-label="미리보기 닫기">닫기</button>
        </header>
        <article className="editor-preview-content blog-post-content" dangerouslySetInnerHTML={{ __html: preview ?? '' }} />
      </section>
    </div>
  </div>;
}

const activeMounts = new WeakMap<HTMLElement, () => void>();

export function mountPage(scope: ParentNode): (() => void) | undefined {
  const root = findEditorRoot(scope);
  if (!root) return undefined;
  const active = activeMounts.get(root);
  if (active) return active;

  const form = root.closest<HTMLFormElement>('form');
  const body = form?.elements.namedItem('text_md');
  const storageKey = root.dataset.storageKey;
  if (!form || !(body instanceof HTMLTextAreaElement) || !storageKey) return undefined;

  if (root.dataset.saved === 'true') clearSavedDraft(storageKey);
  const reactRoot = createRoot(root);
  reactRoot.render(<EditorTools form={form} body={body} storageKey={storageKey} />);

  const settingsDialog = form.querySelector<HTMLDialogElement>('#editor-settings-dialog');
  const postCover = form.querySelector<HTMLElement>('.post-editor-cover');
  const coverImageFrame = postCover?.querySelector<HTMLElement>('.post-editor-cover-image');
  const coverFileInput = form.querySelector<HTMLInputElement>('[data-editor-cover-file]');
  const coverUrlInput = form.querySelector<HTMLInputElement>('input[name="cover_image_url"]');
  const windowObject = root.ownerDocument.defaultView;
  const uploadController = new AbortController();
  let draftSubmission = false;
  let focusTimer: number | undefined;
  let mounted = true;

  const syncCoverPreview = () => {
    if (!postCover || !coverImageFrame) return;
    const layout = form.querySelector<HTMLInputElement>('input[name="cover_layout"]:checked')?.value;
    const position = form.elements.namedItem('cover_image_position');
    const ratio = form.elements.namedItem('cover_image_ratio');
    const url = form.elements.namedItem('cover_image_url');
    if (layout) postCover.dataset.coverLayout = layout;
    if (position instanceof HTMLSelectElement) postCover.dataset.coverImagePosition = position.value;
    if (ratio instanceof HTMLSelectElement) postCover.dataset.coverImageRatio = ratio.value;

    const value = url instanceof HTMLInputElement ? url.value.trim() : '';
    const remove = form.querySelector<HTMLInputElement>('input[name="remove_cover_image"]');
    const safe = !remove?.checked && value.startsWith('/resources/media/') && !value.includes('..') && !/[\\\u0000-\u0020]/.test(value);
    let image = coverImageFrame.querySelector<HTMLImageElement>('img');
    if (!safe) {
      image?.remove();
      coverImageFrame.dataset.coverEmpty = 'true';
      return;
    }
    if (!image) {
      image = root.ownerDocument.createElement('img');
      image.id = 'editor-cover-preview';
      image.alt = '';
      image.setAttribute('data-no-filter', '');
      coverImageFrame.prepend(image);
    }
    image.src = value;
    coverImageFrame.dataset.coverEmpty = 'false';
  };

  const handleCoverUpload = async () => {
    const file = coverFileInput?.files?.item(0);
    if (!file || !coverFileInput) return;
    const status = form.querySelector<HTMLElement>('[data-editor-cover-status]');
    const remove = form.querySelector<HTMLInputElement>('input[name="remove_cover_image"]');
    if (!coverUrlInput) return;
    if (status) {
      status.dataset.error = 'false';
      status.textContent = '대표 이미지를 올리는 중입니다.';
    }
    try {
      const uploadedUrl = await uploadEditorImage(form, file, uploadController.signal);
      if (!mounted) return;
      coverUrlInput.value = uploadedUrl;
      if (remove) remove.checked = false;
      coverUrlInput.dispatchEvent(new Event('input', { bubbles: true }));
      remove?.dispatchEvent(new Event('change', { bubbles: true }));
      if (status) status.textContent = '대표 이미지를 추가했습니다.';
      form.dispatchEvent(new Event('input', { bubbles: true }));
    } catch (error) {
      if (uploadController.signal.aborted) return;
      if (status) {
        status.dataset.error = 'true';
        status.textContent = error instanceof Error ? error.message : '대표 이미지를 올리지 못했습니다.';
      }
    } finally {
      if (coverFileInput) coverFileInput.value = '';
    }
  };

  const handleSubmit = (event: Event) => {
    const submitter = (event as SubmitEvent).submitter;
    if (submitter instanceof HTMLButtonElement && submitter.value === 'draft') draftSubmission = true;
  };
  const handlePageHide = () => {
    if (!draftSubmission) saveEditorRecovery(storageKey, form);
  };
  const handleClick = (event: MouseEvent) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest('[data-editor-cover-upload]')) {
      coverFileInput?.click();
      return;
    }
    const open = target.closest<HTMLElement>('[data-editor-open-settings]');
    if (open && settingsDialog) {
      if (!settingsDialog.open) settingsDialog.showModal();
      if (open.classList.contains('editor-cover-picker')) {
        windowObject?.clearTimeout(focusTimer);
        focusTimer = windowObject?.setTimeout(() => coverUrlInput?.focus(), 50);
      }
    }
    if (target.closest('[data-editor-close-settings]')) settingsDialog?.close();
    if (target.closest('[data-editor-preview]') && !root.contains(target)) {
      form.dispatchEvent(new Event('blex:editor-preview'));
    }
    if (target === settingsDialog) settingsDialog?.close();
  };

  syncCoverPreview();
  form.addEventListener('change', syncCoverPreview);
  coverUrlInput?.addEventListener('input', syncCoverPreview);
  coverFileInput?.addEventListener('change', handleCoverUpload);
  form.addEventListener('submit', handleSubmit);
  form.addEventListener('click', handleClick);
  windowObject?.addEventListener('pagehide', handlePageHide);

  const cleanup = () => {
    if (!mounted) return;
    mounted = false;
    form.removeEventListener('change', syncCoverPreview);
    coverUrlInput?.removeEventListener('input', syncCoverPreview);
    coverFileInput?.removeEventListener('change', handleCoverUpload);
    form.removeEventListener('submit', handleSubmit);
    form.removeEventListener('click', handleClick);
    windowObject?.removeEventListener('pagehide', handlePageHide);
    windowObject?.clearTimeout(focusTimer);
    uploadController.abort();
    try {
      reactRoot.unmount();
    } finally {
      activeMounts.delete(root);
    }
  };
  activeMounts.set(root, cleanup);
  return cleanup;
}

function findEditorRoot(scope: ParentNode): HTMLElement | null {
  if (typeof HTMLElement !== 'undefined' && scope instanceof HTMLElement && scope.matches('#blex-editor-tools')) return scope;
  return scope.querySelector<HTMLElement>('#blex-editor-tools');
}

if (typeof document !== 'undefined' && !document.getElementById('blex-application')) {
  mountPage(document);
}
