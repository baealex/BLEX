import './tailwind.css';
import './site.scss';

const root = document.documentElement;
const systemTheme = matchMedia('(prefers-color-scheme: dark)');
const themeButtons = new WeakSet<HTMLButtonElement>();
const routeTimeouts = new Set<number>();
const routeIntervals = new Set<number>();

let routeController: AbortController | undefined;
let routeGeneration = 0;
let hydrated = !document.getElementById('blex-application');
let clientBindingsInstalled = false;

function readCookie(key: string): string {
  const value = document.cookie.split('; ').find((entry) => entry.startsWith(`${key}=`));
  try { return value ? decodeURIComponent(value.slice(key.length + 1)) : ''; } catch { return ''; }
}

function setTheme(preference = readCookie('blex_theme'), updateControls = hydrated) {
  const mode = preference === 'dark' || preference === 'light' ? preference : 'system';
  const dark = mode === 'dark' || (mode === 'system' && systemTheme.matches);
  const theme = dark ? 'dark' : 'light';
  const changed = root.dataset.theme !== theme;
  root.dataset.theme = theme;
  root.dataset.themePreference = mode;
  root.style.colorScheme = theme;
  if (updateControls) {
    for (const button of document.querySelectorAll<HTMLButtonElement>('[data-site-theme-toggle]')) {
      const label = dark ? '라이트 모드로 전환' : '다크 모드로 전환';
      button.setAttribute('aria-label', label);
      button.title = label;
    }
  }
  if (changed) window.dispatchEvent(new CustomEvent('blex:theme-change', { detail: { theme } }));
}

function clearRouteTimeout(id: number | undefined) {
  if (id === undefined) return;
  window.clearTimeout(id);
  routeTimeouts.delete(id);
}

function scheduleRouteTimeout(callback: () => void, delay: number): number | undefined {
  const owner = routeController;
  if (!owner) return undefined;
  let id = 0;
  id = window.setTimeout(() => {
    routeTimeouts.delete(id);
    if (!owner.signal.aborted) callback();
  }, delay);
  routeTimeouts.add(id);
  return id;
}

function clearRouteInterval(id: number | undefined) {
  if (id === undefined) return;
  window.clearInterval(id);
  routeIntervals.delete(id);
}

function startRouteInterval(callback: () => void, delay: number): number | undefined {
  const owner = routeController;
  if (!owner) return undefined;
  const id = window.setInterval(() => {
    if (owner.signal.aborted) {
      clearRouteInterval(id);
      return;
    }
    callback();
  }, delay);
  routeIntervals.add(id);
  return id;
}

function disposeRouteBindings() {
  routeController?.abort();
  routeController = undefined;
  for (const id of routeTimeouts) window.clearTimeout(id);
  for (const id of routeIntervals) window.clearInterval(id);
  routeTimeouts.clear();
  routeIntervals.clear();
}

function closeTransientUi() {
  for (const panel of document.querySelectorAll<HTMLElement>('[data-site-search-panel]')) panel.hidden = true;
  for (const menu of document.querySelectorAll<HTMLDialogElement>('#blex-mobile-menu')) {
    if (menu.open) menu.close();
  }
  for (const toggle of document.querySelectorAll<HTMLButtonElement>('[data-site-menu-open]')) {
    toggle.setAttribute('aria-expanded', 'false');
  }
  for (const details of document.querySelectorAll<HTMLDetailsElement>('[data-account-menu]')) details.open = false;
  for (const dialog of document.querySelectorAll<HTMLDialogElement>('dialog[open]')) {
    if (dialog.open) dialog.close();
  }
}

function bindThemeButtons() {
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-site-theme-toggle]')) {
    if (themeButtons.has(button)) continue;
    themeButtons.add(button);
    button.addEventListener('click', () => {
      const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
      document.cookie = `blex_theme=${next}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`;
      setTheme(next);
    });
  }
}

function updateHeader() {
  const header = document.querySelector<HTMLElement>('[data-site-header]');
  if (!header) return;
  header.classList.toggle('border-line-light', scrollY > 0);
  header.classList.toggle('border-transparent', scrollY === 0);
}

function rememberSearch(query: string) {
  if (!query) return;
  try {
    const value: unknown = JSON.parse(localStorage.getItem('blex-recent-searches') ?? '[]');
    const previous = Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];
    localStorage.setItem('blex-recent-searches', JSON.stringify([query, ...previous.filter((entry) => entry !== query)].slice(0, 6)));
  } catch { /* Search works without browser storage. */ }
}

function recentSearches(): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem('blex-recent-searches') ?? '[]');
    return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string').slice(0, 6) : [];
  } catch { return []; }
}

function bindQuickSearch(search: HTMLElement, signal: AbortSignal) {
  const form = search.querySelector<HTMLFormElement>('form');
  const input = search.querySelector<HTMLInputElement>('input');
  const panel = search.querySelector<HTMLElement>('[data-site-search-panel]');
  const heading = search.querySelector<HTMLElement>('[data-site-search-heading]');
  const list = search.querySelector<HTMLElement>('[data-site-search-results]');
  if (!form || !input || !panel || !heading || !list) return;
  let pending: AbortController | undefined;
  let delay: number | undefined;
  let selected = -1;

  const cancel = () => {
    clearRouteTimeout(delay);
    delay = undefined;
    pending?.abort();
    pending = undefined;
    panel.hidden = true;
  };
  signal.addEventListener('abort', cancel, { once: true });

  function setRows(rows: Array<{ href: string; title: string; description?: string }>, emptyMessage: string) {
    selected = -1;
    const elements = rows.map(({ href, title, description }) => {
      const item = document.createElement('li');
      const link = document.createElement('a');
      link.href = href;
      link.className = 'blex-quick-search-result block rounded-xl px-3 py-3 text-sm font-semibold text-content hover:bg-surface-subtle';
      link.textContent = title;
      if (description) {
        const line = document.createElement('span');
        line.className = 'mt-0.5 block truncate text-xs font-normal text-content-secondary';
        line.textContent = description;
        link.append(line);
      }
      item.append(link);
      return item;
    });
    if (elements.length === 0) {
      const notice = document.createElement('li');
      notice.className = 'px-3 py-6 text-center text-sm text-content-secondary';
      notice.textContent = emptyMessage;
      elements.push(notice);
    }
    list!.replaceChildren(...elements);
  }

  function suggest() {
    if (signal.aborted) return;
    clearRouteTimeout(delay);
    delay = undefined;
    pending?.abort();
    pending = undefined;
    panel!.hidden = false;
    const query = input!.value.trim();
    heading!.textContent = query ? '빠른 검색 결과' : '최근 검색';
    if (!query) {
      setRows(recentSearches().map((entry) => ({ href: `/search?${new URLSearchParams({ q: entry })}`, title: entry })), '최근 검색어가 없습니다.');
      return;
    }
    setRows([], '검색 중…');
    delay = scheduleRouteTimeout(async () => {
      delay = undefined;
      if (signal.aborted) return;
      const controller = new AbortController();
      pending = controller;
      const abortRequest = () => controller.abort();
      signal.addEventListener('abort', abortRequest, { once: true });
      try {
        const response = await fetch(`/v1/search?${new URLSearchParams({ q: query })}`, { signal: controller.signal });
        const result = await response.json();
        const matches: unknown = result.body?.results;
        const rows = Array.isArray(matches) ? matches.slice(0, 5).flatMap((post) => {
          if (typeof post?.author !== 'string' || typeof post?.url !== 'string' || typeof post?.title !== 'string') return [];
          return [{ href: `/@${encodeURIComponent(post.author)}/${encodeURIComponent(post.url)}`, title: post.title,
            description: `@${post.author}${typeof post.description === 'string' && post.description ? ` · ${post.description}` : ''}` }];
        }) : [];
        if (!signal.aborted && !controller.signal.aborted) setRows(rows, '빠른 검색 결과가 없습니다.');
      } catch {
        if (!signal.aborted && !controller.signal.aborted) setRows([], '검색 화면에서 다시 시도해 주세요.');
      } finally {
        signal.removeEventListener('abort', abortRequest);
        if (pending === controller) pending = undefined;
      }
    }, 200);
  }

  input.addEventListener('focus', suggest, { signal });
  input.addEventListener('input', suggest, { signal });
  form.addEventListener('submit', () => rememberSearch(input!.value.trim()), { signal });
  list.addEventListener('click', (event) => {
    if (event.target instanceof Element && event.target.closest('a')) rememberSearch(input!.value.trim());
  }, { signal });
  document.addEventListener('click', (event) => {
    if (event.target instanceof Node && !search.contains(event.target)) panel!.hidden = true;
  }, { signal });
  document.addEventListener('keydown', (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k' && search.getClientRects().length) {
      event.preventDefault();
      input!.focus();
    }
  }, { signal });
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') { panel!.hidden = true; return; }
    if (panel!.hidden) return;
    const links = [...list!.querySelectorAll<HTMLAnchorElement>('a')];
    if (event.key === 'Enter' && selected >= 0 && links[selected]) {
      event.preventDefault();
      links[selected].click();
    }
    if (!links.length || (event.key !== 'ArrowDown' && event.key !== 'ArrowUp')) return;
    event.preventDefault();
    selected = event.key === 'ArrowDown' ? (selected + 1) % links.length : (selected <= 0 ? links.length - 1 : selected - 1);
    links.forEach((link, index) => link.dataset.selected = index === selected ? 'true' : 'false');
    links[selected].scrollIntoView({ block: 'nearest' });
  }, { signal });
}

function bindNoticeCarousels(signal: AbortSignal) {
  for (const carousel of document.querySelectorAll<HTMLElement>('[data-notice-carousel]')) {
    const slides = [...carousel.querySelectorAll<HTMLElement>('[data-notice-slide]')];
    const controls = carousel.querySelector<HTMLElement>('[data-notice-controls]');
    if (!controls || slides.length < 2) continue;
    const dots = [...controls.querySelectorAll<HTMLButtonElement>('[data-notice-index]')];
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
    let current = 0;
    let timer: number | undefined;
    const select = (index: number) => {
      current = (index + slides.length) % slides.length;
      slides.forEach((slide, position) => { slide.hidden = position !== current; });
      dots.forEach((dot, position) => dot.setAttribute('aria-pressed', String(position === current)));
    };
    const stop = () => {
      clearRouteInterval(timer);
      timer = undefined;
    };
    const start = () => {
      stop();
      if (!signal.aborted && !reducedMotion.matches && !carousel.matches(':hover, :focus-within')) {
        timer = startRouteInterval(() => select(current + 1), 5000);
      }
    };
    dots.forEach((dot, position) => dot.addEventListener('click', () => select(position), { signal }));
    for (const button of controls.querySelectorAll<HTMLButtonElement>('[data-notice-step]')) {
      button.addEventListener('click', () => select(current + Number(button.dataset.noticeStep)), { signal });
    }
    carousel.addEventListener('pointerenter', stop, { signal });
    carousel.addEventListener('pointerleave', start, { signal });
    carousel.addEventListener('focusin', stop, { signal });
    carousel.addEventListener('focusout', () => { scheduleRouteTimeout(start, 0); }, { signal });
    reducedMotion.addEventListener('change', start, { signal });
    select(0);
    controls.hidden = false;
    start();
  }
}

async function saveAbout(url: string, content: string) {
  const token = /(?:^|; )csrftoken=([^;]+)/.exec(document.cookie)?.[1] ?? '';
  try {
    const response = await fetch(url, {
      method: 'POST', body: new URLSearchParams({ aboutMarkdown: content }),
      headers: { 'X-CSRFToken': token, Accept: 'application/json' },
    });
    const data = await response.json().catch(() => ({})) as { status?: string; message?: string; aboutMarkdown?: string; aboutHtml?: string };
    if (response.ok && data.status === 'success') return { ok: true as const, message: data.message ?? '소개글을 저장했습니다.', markdown: data.aboutMarkdown ?? '', html: data.aboutHtml ?? '' };
    return { ok: false as const, message: data.message ?? '소개글을 저장하지 못했습니다.' };
  } catch {
    return { ok: false as const, message: '네트워크 오류로 저장하지 못했습니다.' };
  }
}

function bindAboutEditors(signal: AbortSignal) {
  for (const page of document.querySelectorAll<HTMLElement>('[data-about-page]')) {
    const input = page.querySelector<HTMLTextAreaElement>('[data-about-input]');
    const save = page.querySelector<HTMLButtonElement>('[data-about-save]');
    const message = page.querySelector<HTMLElement>('[data-about-message]');
    if (!input || !save || !message) continue;
    save.addEventListener('click', () => {
      save.disabled = true;
      save.textContent = '저장 중...';
      void saveAbout(page.dataset.aboutUrl ?? '', input.value).then((result) => {
        message.textContent = result.message;
        message.hidden = false;
        if (result.ok) location.replace(page.dataset.aboutReturn ?? '/');
      }).finally(() => {
        save.disabled = false;
        save.textContent = '저장';
      });
    }, { signal });
  }

  for (const section of document.querySelectorAll<HTMLElement>('[data-about-editor]')) {
    const part = <T extends HTMLElement>(name: string) => section.querySelector<T>(`[data-about-${name}]`);
    const input = part<HTMLTextAreaElement>('input');
    const form = part('form');
    const content = part('content');
    const empty = part('empty');
    const actions = part('actions');
    const message = part('message');
    const save = part<HTMLButtonElement>('save');
    const cancel = part<HTMLButtonElement>('cancel');
    if (!input || !form || !content || !empty || !actions || !message || !save || !cancel) continue;
    let saved = input.value;
    const showEditor = (editing: boolean) => {
      const hasContent = Boolean(content.innerHTML.trim());
      form.hidden = !editing;
      content.hidden = editing || !hasContent;
      empty.hidden = editing || hasContent;
      actions.hidden = editing || !hasContent;
    };
    const notify = (text: string, failed: boolean) => {
      message.textContent = text;
      message.hidden = !text;
      message.classList.toggle('text-danger', failed);
      message.classList.toggle('text-success', !failed);
    };
    section.addEventListener('click', (event) => {
      if (!(event.target instanceof Element) || !event.target.closest('[data-about-edit]')) return;
      event.preventDefault();
      input.value = saved;
      notify('', false);
      showEditor(true);
      input.focus();
    }, { signal });
    cancel.addEventListener('click', () => {
      input.value = saved;
      notify('', false);
      showEditor(false);
    }, { signal });
    save.addEventListener('click', () => {
      save.disabled = true;
      cancel.disabled = true;
      save.textContent = '저장 중...';
      void saveAbout(section.dataset.aboutUrl ?? '', input.value).then((result) => {
        notify(result.message, !result.ok);
        if (!result.ok) return;
        saved = result.markdown;
        input.value = saved;
        content.innerHTML = result.html;
        showEditor(false);
      }).finally(() => {
        save.disabled = false;
        cancel.disabled = false;
        save.textContent = '저장';
      });
    }, { signal });
  }
}

function bindRouteElements() {
  disposeRouteBindings();
  const controller = new AbortController();
  routeController = controller;
  const { signal } = controller;
  bindAboutEditors(signal);

  for (const form of document.querySelectorAll<HTMLFormElement>('[data-settings-brand-upload]')) {
    const input = form.querySelector<HTMLInputElement>('input[type="file"]');
    input?.addEventListener('change', () => {
      if (input.files?.length) form.requestSubmit();
    }, { signal });
  }

  for (const input of document.querySelectorAll<HTMLInputElement>('[data-work-log-attachment]')) {
    const filename = input.parentElement?.querySelector<HTMLElement>('[data-work-log-filename]');
    input.addEventListener('change', () => {
      if (filename) filename.textContent = input.files?.[0]?.name ?? '';
    }, { signal });
  }

  for (const box of document.querySelectorAll<HTMLElement>('[data-work-log-share-link]')) {
    const link = box.querySelector<HTMLInputElement>('input');
    const button = box.querySelector<HTMLButtonElement>('[data-work-log-copy]');
    const status = box.querySelector<HTMLElement>('[data-work-log-copied]');
    link?.addEventListener('focus', () => link.select(), { signal });
    button?.addEventListener('click', () => {
      link?.select();
      void navigator.clipboard?.writeText(link?.value ?? '').then(() => {
        button.textContent = '링크를 복사했어요';
        if (status) status.textContent = '링크를 복사했어요';
      }).catch(() => undefined);
    }, { signal });
  }

  const mobileMenu = document.querySelector<HTMLDialogElement>('#blex-mobile-menu');
  mobileMenu?.addEventListener('close', () => {
    document.querySelector<HTMLButtonElement>('[data-site-menu-open]')?.setAttribute('aria-expanded', 'false');
  }, { signal });

  const siteSettingsForm = document.querySelector<HTMLFormElement>('[data-site-settings-form]');
  const siteSettingsSave = document.querySelector<HTMLButtonElement>('[data-site-settings-save]');
  if (siteSettingsForm && siteSettingsSave) {
    const fields = [...siteSettingsForm.elements].filter((field): field is HTMLInputElement | HTMLTextAreaElement =>
      field instanceof HTMLTextAreaElement || (field instanceof HTMLInputElement && field.type !== 'hidden'));
    const updateSave = () => { siteSettingsSave.disabled = fields.every((field) => field.value === field.defaultValue); };
    fields.forEach((field) => field.addEventListener('input', updateSave, { signal }));
    updateSave();
  }

  bindNoticeCarousels(signal);
  for (const details of document.querySelectorAll<HTMLDetailsElement>('[data-comment-edit]')) {
    const id = details.dataset.commentEdit ?? '';
    const field = details.querySelector<HTMLTextAreaElement>('textarea');
    const submit = details.querySelector<HTMLButtonElement>('button[type=submit]');
    const status = details.querySelector<HTMLElement>('[data-comment-edit-status]');
    if (!/^\d+$/.test(id) || !field || !submit || !status) continue;
    let loaded = false;
    let loading = false;
    async function openEditor() {
      if (signal.aborted || !field || !submit || !status || loaded || loading) return;
      loading = true;
      status.textContent = '댓글을 불러오는 중입니다.';
      try {
        const response = await fetch(`/v1/comments/${id}`, { cache: 'no-store', signal });
        const result = await response.json();
        if (!response.ok || typeof result.body?.textMd !== 'string') throw new Error('Comment unavailable');
        if (signal.aborted || !field.isConnected) return;
        field.value = result.body.textMd;
        field.disabled = submit.disabled = false;
        status.textContent = '';
        loaded = true;
        if (details.open) field.focus();
      } catch {
        if (!signal.aborted && status.isConnected) status.textContent = '댓글을 불러오지 못했습니다. 다시 열어 주세요.';
      } finally {
        loading = false;
      }
    }
    details.querySelector('summary')?.addEventListener('click', () => { if (!details.open) void openEditor(); }, { signal });
    details.addEventListener('toggle', () => { if (details.open) void openEditor(); }, { signal });
  }

  for (const form of document.querySelectorAll<HTMLFormElement>('[data-site-logout]')) {
    form.addEventListener('submit', (event) => {
      const field = form.elements.namedItem('csrfmiddlewaretoken');
      if (!(field instanceof HTMLInputElement)) return;
      field.value ||= readCookie('csrftoken');
      if (field.value) return;
      event.preventDefault();
      void fetch('/v1/login', { credentials: 'same-origin' }).then(() => {
        if (!form.isConnected || signal.aborted) return;
        field.value = readCookie('csrftoken');
        if (field.value) form.requestSubmit();
      }).catch(() => undefined);
    }, { signal });
  }

  const siteSearch = document.querySelector<HTMLElement>('[data-site-search]');
  if (siteSearch) bindQuickSearch(siteSearch, signal);
  if (document.querySelector('[data-heatmap-days]')) {
    void import('./author-heatmap.js').then(({ mountAuthorHeatmaps }) => {
      if (!signal.aborted) mountAuthorHeatmaps(signal);
    });
  }
}

function handleGlobalClick(event: MouseEvent) {
  if (!(event.target instanceof Element)) return;
  const target = event.target;

  if (target.closest('[data-history-back]')) {
    if (history.length > 1) history.back();
    else location.href = '/';
  }

  const menuToggle = target.closest<HTMLButtonElement>('[data-site-menu-open]');
  if (menuToggle) {
    const menu = document.querySelector<HTMLDialogElement>('#blex-mobile-menu');
    if (menu && !menu.open) {
      menu.showModal();
      menuToggle.setAttribute('aria-expanded', 'true');
    }
  }

  const dialogButton = target.closest<HTMLButtonElement>('[data-open-dialog]');
  if (dialogButton) {
    const dialog = document.getElementById(dialogButton.dataset.openDialog ?? '');
    if (dialog instanceof HTMLDialogElement && !dialog.open) dialog.showModal();
  }

  const dialog = target instanceof HTMLDialogElement ? target : target.closest('dialog');
  if (dialog instanceof HTMLDialogElement &&
      (target === dialog || target.closest('a[href^="#"]'))) dialog.close();

  const copiedButton = target.closest<HTMLElement>('[data-copy-link]');
  if (copiedButton) {
    const generation = routeGeneration;
    const status = copiedButton.parentElement?.querySelector<HTMLElement>('[data-copy-status]');
    void (async () => {
      try {
        await navigator.clipboard.writeText(copiedButton.dataset.copyLink ?? '');
        if (generation === routeGeneration && copiedButton.isConnected && status?.isConnected) status.textContent = copiedButton.dataset.copyMessage ?? '링크가 복사되었습니다.';
      } catch {
        if (generation === routeGeneration && copiedButton.isConnected && status?.isConnected) status.textContent = '복사에 실패했습니다.';
      }
    })();
  }

  for (const details of document.querySelectorAll<HTMLDetailsElement>('[data-account-menu]')) {
    if (!details.contains(target)) details.open = false;
  }
}

function handleGlobalKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape') return;
  for (const details of document.querySelectorAll<HTMLDetailsElement>('[data-account-menu]')) details.open = false;
}

function handleBeforePageChange() {
  routeGeneration += 1;
  if (!hydrated) return;
  disposeRouteBindings();
  closeTransientUi();
}

function handlePageChange() {
  routeGeneration += 1;
  if (hydrated) {
    disposeRouteBindings();
    closeTransientUi();
  } else {
    hydrated = true;
  }
  activateClientBindings();
}

function activateClientBindings() {
  if (!clientBindingsInstalled) {
    clientBindingsInstalled = true;
    window.addEventListener('scroll', updateHeader, { passive: true });
    document.addEventListener('click', handleGlobalClick);
    document.addEventListener('keydown', handleGlobalKeydown);
  }
  bindThemeButtons();
  setTheme();
  updateHeader();
  bindRouteElements();
}

systemTheme.addEventListener('change', () => setTheme(undefined, hydrated));
document.addEventListener('blex:before-page-change', handleBeforePageChange);
document.addEventListener('blex:page-change', handlePageChange);

setTheme(undefined, hydrated);
if (hydrated) activateClientBindings();
