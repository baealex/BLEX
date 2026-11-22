import { hydrateRoot } from 'react-dom/client';
import {
  createBrowserRouter,
  redirect,
  replace,
  RouterProvider,
  useLoaderData,
  useLocation,
  useNavigationType,
  useRouteError,
  type LoaderFunctionArgs,
} from 'react-router';
import { useEffect, useLayoutEffect } from 'react';
import { ApplicationFrame, type ApplicationView } from './frame.js';
import { openLoginPromptFrom } from './login-prompt.js';
import { opensOutsideApplication, type BlexNavigateDetail } from './navigation.js';
import type { SiteHeaderProps } from '../appearance/shell.js';

interface HeadLink {
  attributes: Array<[string, string]>;
}

interface HeadStyle {
  text: string;
  nonce?: string;
}

interface HeadMeta {
  attributes: Array<[string, string]>;
}

interface HeadScript {
  attributes: Array<[string, string]>;
  text: string;
}

interface PageHead {
  title: string;
  lang: string;
  metas: HeadMeta[];
  links: HeadLink[];
  styles: HeadStyle[];
  scripts: HeadScript[];
}

interface ApplicationDocument {
  view: ApplicationView;
  url: string;
  head: PageHead;
  bodyAttributes: Array<[string, string]>;
  pageModules: Array<{ name: 'login' | 'editor' | 'comments'; source: string }>;
  needsHcaptcha: boolean;
}

interface PageChangeDetail {
  from: string;
  to: string;
  navigationType: 'POP' | 'PUSH' | 'REPLACE';
}

interface PagePosition {
  x: number;
  y: number;
  focusId: string;
}

const routeHeadAttribute = 'data-blex-route-head';
const scrollStoragePrefix = 'blex-route-position:';
let currentDocument: ApplicationDocument | null = null;
let currentPageCleanup: (() => void) | null = null;
let pageModuleGeneration = 0;
let currentHistoryKey = 'default';
let hasCommittedInitialDocument = false;
let router: ReturnType<typeof createBrowserRouter> | null = null;
const stagedDocuments = new Map<string, ApplicationDocument>();
const pendingPostForms = new WeakSet<HTMLFormElement>();
const activePostRequests = new Set<AbortController>();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isOptionalString(value: unknown): value is string | null | undefined {
  return value === undefined || value === null || typeof value === 'string';
}

function parseHeader(serialized: string | undefined): SiteHeaderProps | null | undefined {
  if (serialized === undefined) return undefined;
  let value: unknown;
  try { value = JSON.parse(serialized); } catch { return undefined; }
  if (value === null) return null;
  if (!isRecord(value)) return undefined;

  if (value.brand !== undefined && value.brand !== null) {
    if (!isRecord(value.brand) || typeof value.brand.siteName !== 'string' ||
        !isOptionalString(value.brand.logoUrl) || !isOptionalString(value.brand.darkLogoUrl)) return undefined;
  }
  if (value.viewer !== undefined && value.viewer !== null) {
    if (!isRecord(value.viewer) ||
        !isOptionalString(value.viewer.username) || !isOptionalString(value.viewer.csrfToken) ||
        ![value.viewer.hasEditorRole, value.viewer.isStaff].every((entry) => entry === undefined || typeof entry === 'boolean') ||
        !(value.viewer.unreadCount === undefined || (typeof value.viewer.unreadCount === 'number' && Number.isFinite(value.viewer.unreadCount)))) return undefined;
  }
  if (![value.searchPage, value.editorPage, value.hideAuthLinks].every((entry) => entry === undefined || typeof entry === 'boolean')) return undefined;
  return value as SiteHeaderProps;
}

function attributesOf(element: Element, exclude: ReadonlySet<string> = new Set()): Array<[string, string]> {
  return Array.from(element.attributes)
    .filter((attribute) => !exclude.has(attribute.name.toLowerCase()) && !attribute.name.toLowerCase().startsWith('on'))
    .map((attribute) => [attribute.name, attribute.value]);
}

function normalizedLinkAttributes(element: HTMLLinkElement, pageUrl: URL): Array<[string, string]> {
  const attributes = attributesOf(element, new Set([routeHeadAttribute]));
  const href = element.getAttribute('href');
  if (href) {
    const absolute = new URL(href, pageUrl);
    const index = attributes.findIndex(([name]) => name.toLowerCase() === 'href');
    if (index >= 0) attributes[index] = ['href', absolute.href];
  }
  return attributes;
}

function collectHead(source: Document, pageUrl: URL): PageHead {
  const metas = Array.from(source.head.querySelectorAll<HTMLMetaElement>('meta[name], meta[property]'))
    .filter((meta) => meta.name.toLowerCase() !== 'blex-application' && meta.name.toLowerCase() !== 'viewport')
    .map((meta) => ({ attributes: attributesOf(meta, new Set([routeHeadAttribute])) }));
  const links = Array.from(source.head.querySelectorAll<HTMLLinkElement>('link[rel]'))
    .filter((link) => {
      if (link.hasAttribute('data-blex-theme')) return false;
      const rel = new Set(link.rel.toLowerCase().split(/\s+/));
      return rel.has('stylesheet') || rel.has('canonical') || rel.has('alternate') || rel.has('icon') ||
        rel.has('apple-touch-icon') || rel.has('mask-icon');
    })
    .map((link) => ({ attributes: normalizedLinkAttributes(link, pageUrl) }));
  const styles = Array.from(source.head.querySelectorAll<HTMLStyleElement>('style'))
    .map((style) => ({ text: style.textContent ?? '', nonce: style.nonce || undefined }));
  const scripts = Array.from(source.head.querySelectorAll<HTMLScriptElement>('script[type="application/ld+json"]'))
    .map((script) => ({
      attributes: attributesOf(script, new Set(['src', routeHeadAttribute])),
      text: script.textContent ?? '',
    }));
  return {
    title: source.title,
    lang: source.documentElement.lang,
    metas,
    links,
    styles,
    scripts,
  };
}

function hasTrustedHcaptchaScript(source: Document, pageUrl: URL): boolean {
  return Array.from(source.querySelectorAll<HTMLScriptElement>('script[data-blex-trusted-script="hcaptcha"][src]'))
    .some((script) => {
      try {
        const url = new URL(script.getAttribute('src') ?? '', pageUrl);
        return url.origin === 'https://js.hcaptcha.com' && url.pathname === '/1/api.js' && !url.search && !url.hash;
      } catch { return false; }
    });
}

function pageModuleSources(source: Document): ApplicationDocument['pageModules'] {
  return Array.from(source.querySelectorAll<HTMLScriptElement>('script[data-blex-page-module]'))
    .map((script): ApplicationDocument['pageModules'][number] | null => {
      const name = script.dataset.blexPageModule;
      const src = script.getAttribute('src');
      if ((name !== 'login' && name !== 'editor' && name !== 'comments') || !src) return null;
      return { name, source: src };
    })
    .filter((entry): entry is ApplicationDocument['pageModules'][number] => entry !== null);
}

function bodyAttributes(source: Document): Array<[string, string]> {
  return source.body ? attributesOf(source.body) : [];
}

function readApplicationDocument(source: Document, url: string): ApplicationDocument | null {
  if (!source.head.querySelector('meta[name="blex-application"][content="1"]')) return null;
  const root = source.getElementById('blex-application');
  const content = source.getElementById('blex-route-content');
  const header = parseHeader(root?.dataset.header);
  if (!root || !content || header === undefined) return null;

  let pageUrl: URL;
  try { pageUrl = new URL(url, window.location.href); } catch { return null; }
  return {
    view: { header, html: content.innerHTML },
    url: pageUrl.href,
    head: collectHead(source, pageUrl),
    bodyAttributes: bodyAttributes(source),
    pageModules: pageModuleSources(source),
    needsHcaptcha: hasTrustedHcaptchaScript(source, pageUrl),
  };
}

function requiredNavigation(url: string): never {
  throw new NativeNavigationRequired(url);
}

class NativeNavigationRequired extends Error {
  constructor(readonly url: string) {
    super('The response is not a BLEX application document.');
    this.name = 'NativeNavigationRequired';
  }
}

async function loadApplicationDocument({ request }: LoaderFunctionArgs): Promise<ApplicationDocument> {
  let requestUrl: URL;
  try { requestUrl = new URL(request.url); } catch { return requiredNavigation(request.url); }
  saveCurrentPosition();
  const staged = stagedDocuments.get(pageRequestKey(requestUrl));
  if (staged) {
    stagedDocuments.delete(pageRequestKey(requestUrl));
    if (request.signal.aborted) throw new DOMException('Navigation was cancelled.', 'AbortError');
    dispatchLifecycle('blex:before-page-change', {
      from: window.location.href,
      to: staged.url,
      navigationType: router?.state.historyAction ?? 'PUSH',
    });
    disposeActivePage();
    return staged;
  }

  let response: Response;
  try {
    response = await fetch(requestUrl.href, {
      method: 'GET',
      credentials: 'same-origin',
      redirect: 'follow',
      signal: request.signal,
      headers: { Accept: 'text/html,application/xhtml+xml', 'X-Blex-Application-Request': '1' },
    });
  } catch (error) {
    if (request.signal.aborted) throw error;
    return requiredNavigation(requestUrl.href);
  }
  if (request.signal.aborted) throw new DOMException('Navigation was cancelled.', 'AbortError');

  const finalUrl = new URL(response.url || requestUrl.href, requestUrl);
  if (finalUrl.origin !== window.location.origin) return requiredNavigation(finalUrl.href);
  if (!response.ok && response.status !== 404) return requiredNavigation(finalUrl.href);
  const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
  if (contentType && !contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
    return requiredNavigation(finalUrl.href);
  }

  const markup = await response.text();
  if (request.signal.aborted) throw new DOMException('Navigation was cancelled.', 'AbortError');
  const parsed = new DOMParser().parseFromString(markup, 'text/html');
  const document = readApplicationDocument(parsed, finalUrl.href);
  if (!document) return requiredNavigation(finalUrl.href);

  if (response.redirected && !sameRoute(finalUrl, requestUrl)) {
    const redirected = new URL(finalUrl.href);
    if (!redirected.hash) redirected.hash = requestUrl.hash;
    const currentUrl = new URL(window.location.href);
    const responsePath = redirected.pathname + redirected.search + redirected.hash;
    if (sameRoute(requestUrl, currentUrl) || sameRoute(redirected, currentUrl)) return replace(responsePath) as never;
    return redirect(responsePath) as never;
  }

  if (request.signal.aborted) throw new DOMException('Navigation was cancelled.', 'AbortError');
  dispatchLifecycle('blex:before-page-change', {
    from: window.location.href,
    to: document.url,
    navigationType: router?.state.historyAction ?? 'PUSH',
  });
  disposeActivePage();
  return document;
}

function sameRoute(left: URL, right: URL): boolean {
  return left.origin === right.origin && left.pathname === right.pathname && left.search === right.search;
}

function pageRequestKey(url: URL): string {
  const key = new URL(url.href);
  key.hash = '';
  return key.href;
}

function dispatchLifecycle(name: 'blex:before-page-change' | 'blex:page-change', detail: PageChangeDetail): void {
  document.dispatchEvent(new CustomEvent<PageChangeDetail>(name, { bubbles: true, detail }));
}

function markExistingRouteHead(): void {
  const selectors = [
    'link[rel~="stylesheet"]:not([data-blex-theme])',
    'link[rel~="canonical"]', 'link[rel~="alternate"]', 'link[rel~="icon"]',
    'link[rel~="apple-touch-icon"]', 'link[rel~="mask-icon"]',
    'meta[name]:not([name="blex-application"]):not([name="viewport"])', 'meta[property]', 'style',
    'script[type="application/ld+json"]',
  ];
  for (const element of document.head.querySelectorAll(selectors.join(','))) element.setAttribute(routeHeadAttribute, '');
}

function appendRouteHead(head: PageHead): void {
  for (const node of document.head.querySelectorAll(`[${routeHeadAttribute}]`)) node.remove();
  for (const meta of head.metas) {
    const node = document.createElement('meta');
    for (const [name, value] of meta.attributes) node.setAttribute(name, value);
    node.setAttribute(routeHeadAttribute, '');
    document.head.append(node);
  }
  for (const link of head.links) {
    const node = document.createElement('link');
    for (const [name, value] of link.attributes) node.setAttribute(name, value);
    node.setAttribute(routeHeadAttribute, '');
    document.head.append(node);
  }
  for (const style of head.styles) {
    const node = document.createElement('style');
    if (style.nonce) node.nonce = style.nonce;
    node.textContent = style.text;
    node.setAttribute(routeHeadAttribute, '');
    document.head.append(node);
  }
  for (const script of head.scripts) {
    const node = document.createElement('script');
    for (const [name, value] of script.attributes) node.setAttribute(name, value);
    node.type = 'application/ld+json';
    node.textContent = script.text;
    node.setAttribute(routeHeadAttribute, '');
    document.head.append(node);
  }
}

function applyDocumentState(page: ApplicationDocument, initial: boolean): void {
  document.title = page.head.title;
  if (page.head.lang) document.documentElement.lang = page.head.lang;
  const allowed = /^(?:class|style|id|dir|lang|hidden|data-[a-z0-9_.:-]+|aria-[a-z0-9_.:-]+)$/i;
  const preserve = new Set(['data-theme', 'data-theme-preference']);
  const nextAttributes = new Map(page.bodyAttributes.filter(([name]) => allowed.test(name)));
  for (const attribute of Array.from(document.body.attributes)) {
    if (!preserve.has(attribute.name) && !nextAttributes.has(attribute.name)) document.body.removeAttribute(attribute.name);
  }
  for (const [name, value] of nextAttributes) document.body.setAttribute(name, value);
  if (initial) markExistingRouteHead();
  else appendRouteHead(page.head);
}

function dispatchNavigateEvent(event: Event): void {
  if (event.defaultPrevented) return;
  const detail = (event as CustomEvent<BlexNavigateDetail>).detail;
  if (!detail || typeof detail.to !== 'string') return;
  let target: URL;
  try { target = new URL(detail.to, window.location.href); } catch { return; }
  if (!isInternalApplicationUrl(target)) return;
  if (sameRoute(target, new URL(window.location.href)) && target.hash === window.location.hash) return;
  const activeRouter = router;
  if (!activeRouter) return;

  event.preventDefault();
  saveCurrentPosition();
  void activeRouter.navigate(`${target.pathname}${target.search}${target.hash}`, { replace: detail.replace });
}

const excludedFileExtension = /\.(?:css|m?js|map|png|jpe?g|gif|webp|avif|svg|ico|woff2?|ttf|otf|eot|pdf|zip|gz|mp3|mp4|webm|json|txt|xml|webmanifest|md)$/i;

function isInternalApplicationUrl(url: URL): boolean {
  if (url.origin !== window.location.origin || !['http:', 'https:'].includes(url.protocol)) return false;
  if (/^\/(?:assets|resources|images|media|settings|admin-settings|search|sign|api|docs)(?:\/|$)/i.test(url.pathname)) return false;
  if (/^\/write\/?$/i.test(url.pathname) || /^\/@[^/]+\/[^/]+\/(?:edit|timelapse)\/?$/i.test(url.pathname)) return false;
  if (excludedFileExtension.test(url.pathname)) return false;
  if (/^\/login\/(?:start|callback)(?:\/|$)/i.test(url.pathname) || /^\/oauth(?:\/|$)/i.test(url.pathname)) return false;
  return true;
}

function shouldLeaveLinkNative(anchor: HTMLAnchorElement): boolean {
  if (anchor.hasAttribute('download') || anchor.hasAttribute('data-no-spa') || anchor.hasAttribute('data-blex-native-navigation')) return true;
  const target = anchor.getAttribute('target');
  if (target && target.toLowerCase() !== '_self') return true;
  if (anchor.relList.contains('external')) return true;
  return false;
}

function handleDocumentClick(event: MouseEvent): void {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const target = event.target;
  if (!(target instanceof Element)) return;
  const anchor = target.closest<HTMLAnchorElement>('a[href]');
  if (!anchor) return;
  if (openLoginPromptFrom(anchor)) {
    event.preventDefault();
    return;
  }
  if (shouldLeaveLinkNative(anchor)) return;

  let destination: URL;
  try { destination = new URL(anchor.href, window.location.href); } catch { return; }
  if (!isInternalApplicationUrl(destination)) return;
  const current = new URL(window.location.href);
  if (sameRoute(destination, current) && destination.hash !== current.hash) return;
  if (destination.href === current.href) return;
  const activeRouter = router;
  if (!activeRouter) return;

  event.preventDefault();
  saveCurrentPosition();
  void activeRouter.navigate(`${destination.pathname}${destination.search}${destination.hash}`);
}

function formHasTarget(form: HTMLFormElement, submitter: HTMLElement | null): boolean {
  const target = submitter?.getAttribute('formtarget') ?? form.getAttribute('target');
  return Boolean(target && target.toLowerCase() !== '_self');
}

function handleDocumentSubmit(event: SubmitEvent): void {
  if (event.defaultPrevented) return;
  const form = event.target;
  if (!(form instanceof HTMLFormElement) || formHasTarget(form, event.submitter)) return;
  const submitter = event.submitter;
  if ((submitter instanceof HTMLButtonElement || submitter instanceof HTMLInputElement) && submitter.type === 'image') return;
  // Named controls can shadow form properties such as action.
  const method = (submitter?.getAttribute('formmethod') ?? form.getAttribute('method') ?? 'get').toLowerCase();
  const enctype = (submitter?.getAttribute('formenctype') ?? form.getAttribute('enctype') ?? 'application/x-www-form-urlencoded').toLowerCase();
  if (method !== 'get' && method !== 'post') return;

  const action = submitter?.getAttribute('formaction') ?? form.getAttribute('action') ?? '';
  let destination: URL;
  try { destination = new URL(action || window.location.href, window.location.href); } catch { return; }
  if (!isInternalApplicationUrl(destination)) return;

  if (method === 'post') {
    if (enctype !== 'application/x-www-form-urlencoded' && enctype !== 'multipart/form-data') return;
    const data = formPostData(form, submitter);
    if (enctype === 'application/x-www-form-urlencoded' && Array.from(data.values()).some((value) => typeof value !== 'string')) return;
    const isFormRedirectEndpoint = /^\/v1\/comments(?:\/\d+)?\/?$/.test(destination.pathname) ||
      /^\/v1\/users\/@[^/]+\/subscription\/?$/.test(destination.pathname) ||
      /^\/v1\/setting\/(?:avatar|cover)\/?$/.test(destination.pathname);
    if (destination.pathname.startsWith('/v1/') &&
        (!isFormRedirectEndpoint || !isSafeFormReturnTo(data.get('return_to')))) return;
    if (destination.pathname.startsWith('/api/')) return;
    const activeRouter = router;
    if (!activeRouter) return;
    if (pendingPostForms.has(form)) {
      event.preventDefault();
      return;
    }
    event.preventDefault();
    pendingPostForms.add(form);
    const controller = new AbortController();
    activePostRequests.add(controller);
    void submitApplicationPost(form, destination, data, enctype, controller).finally(() => {
      pendingPostForms.delete(form);
      activePostRequests.delete(controller);
    });
    return;
  }
  if (method !== 'get') return;

  if (enctype !== 'application/x-www-form-urlencoded') return;
  const data = new FormData(form);
  if (submitter instanceof HTMLButtonElement || submitter instanceof HTMLInputElement) {
    if (submitter.name && !submitter.disabled && submitter.type !== 'image') data.append(submitter.name, submitter.value);
  }
  const params = new URLSearchParams();
  for (const [name, value] of data.entries()) {
    if (typeof value !== 'string') return;
    params.append(name, value);
  }
  destination.search = params.toString();
  const activeRouter = router;
  if (!activeRouter) return;

  event.preventDefault();
  saveCurrentPosition();
  void activeRouter.navigate(`${destination.pathname}${destination.search}${destination.hash}`);
}

function isSafeFormReturnTo(value: FormDataEntryValue | null): value is string {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return false;
  try {
    const url = new URL(value, window.location.href);
    return url.origin === window.location.origin && !decodeURIComponent(url.pathname).startsWith('//') && !url.pathname.startsWith('/v1/') &&
      !url.pathname.startsWith('/api/') && isInternalApplicationUrl(url);
  } catch { return false; }
}

function formPostData(form: HTMLFormElement, submitter: HTMLElement | null): FormData {
  const data = new FormData(form);
  if (submitter instanceof HTMLButtonElement || submitter instanceof HTMLInputElement) {
    if (submitter.name && !submitter.disabled && submitter.type !== 'image') data.append(submitter.name, submitter.value);
  }
  return data;
}

function csrfHeader(data: FormData): Record<string, string> {
  const token = data.get('csrfmiddlewaretoken');
  return typeof token === 'string' && token ? { 'X-CSRFToken': token } : {};
}

function showPostFeedback(form: HTMLFormElement, message: string): void {
  let feedback = form.querySelector<HTMLElement>('[data-blex-post-feedback]');
  if (!feedback) {
    feedback = document.createElement('p');
    feedback.className = 'status error';
    feedback.setAttribute('role', 'alert');
    feedback.setAttribute('aria-live', 'assertive');
    feedback.dataset.blexPostFeedback = '';
    form.prepend(feedback);
  }
  feedback.textContent = message;
}

function formReturnFragment(data: FormData, action: URL, finalUrl: URL): string {
  const returnTo = data.get('return_to');
  if (isSafeFormReturnTo(returnTo)) {
    const target = new URL(returnTo, window.location.href);
    if (sameRoute(target, finalUrl)) return target.hash;
  }
  return sameRoute(action, finalUrl) ? action.hash : '';
}

async function submitApplicationPost(
  form: HTMLFormElement,
  action: URL,
  data: FormData,
  enctype: string,
  controller: AbortController,
): Promise<void> {
  const headers: Record<string, string> = { Accept: 'text/html,application/xhtml+xml', ...csrfHeader(data) };
  let body: FormData | URLSearchParams;
  if (enctype === 'application/x-www-form-urlencoded') {
    const values = new URLSearchParams();
    for (const [name, value] of data.entries()) {
      if (typeof value !== 'string') return;
      values.append(name, value);
    }
    headers['Content-Type'] = 'application/x-www-form-urlencoded;charset=UTF-8';
    body = values;
  } else {
    body = data;
  }

  const activeRouter = router;
  if (!activeRouter) return;
  saveCurrentPosition();
  try {
    const response = await fetch(action.href, {
      method: 'POST',
      body,
      headers,
      credentials: 'same-origin',
      mode: 'same-origin',
      redirect: 'follow',
      signal: controller.signal,
    });
    const finalUrl = new URL(response.url || action.href, action);
    if (finalUrl.origin !== window.location.origin) {
      showPostFeedback(form, '응답 페이지가 사이트 주소와 일치하지 않습니다.');
      return;
    }
    if (response.status === 204 || response.status === 205) {
      activeRouter.revalidate();
      return;
    }
    const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
    if (contentType && !contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
      showPostFeedback(form, '서버 응답을 화면에 표시할 수 없습니다. 페이지를 새로고침해 저장 상태를 확인해 주세요.');
      return;
    }
    const markup = await response.text();
    if (controller.signal.aborted) return;
    const parsed = new DOMParser().parseFromString(markup, 'text/html');
    const fragment = formReturnFragment(data, action, finalUrl);
    if (fragment && !finalUrl.hash) finalUrl.hash = fragment;
    const page = readApplicationDocument(parsed, finalUrl.href);
    if (opensOutsideApplication(response, Boolean(page))) {
      window.location.assign(finalUrl.href);
      return;
    }
    if (!page) {
      showPostFeedback(form, '서버 응답 페이지를 불러오지 못했습니다. 저장 상태를 확인해 주세요.');
      return;
    }

    stagedDocuments.set(pageRequestKey(new URL(page.url)), page);
    const currentUrl = new URL(window.location.href);
    if (sameRoute(currentUrl, finalUrl)) {
      if (currentUrl.hash !== finalUrl.hash) {
        await activeRouter.navigate(finalUrl.pathname + finalUrl.search + finalUrl.hash);
      }
      activeRouter.revalidate();
    } else {
      await activeRouter.navigate(finalUrl.pathname + finalUrl.search + finalUrl.hash);
    }
  } catch (error) {
    if (controller.signal.aborted) return;
    console.error('An application form could not be submitted.', error);
    showPostFeedback(form, '요청 결과를 확인하지 못했습니다. 저장 상태를 확인한 뒤 필요한 경우 다시 시도해 주세요.');
  }
}

function readPosition(key: string): PagePosition | null {
  try {
    const value: unknown = JSON.parse(sessionStorage.getItem(`${scrollStoragePrefix}${key}`) ?? 'null');
    if (!isRecord(value) || typeof value.x !== 'number' || typeof value.y !== 'number' || typeof value.focusId !== 'string') return null;
    return { x: value.x, y: value.y, focusId: value.focusId };
  } catch { return null; }
}

function savePosition(key: string): void {
  const focused = document.activeElement;
  const focusId = focused instanceof HTMLElement ? focused.id : '';
  const value: PagePosition = { x: window.scrollX, y: window.scrollY, focusId };
  try { sessionStorage.setItem(`${scrollStoragePrefix}${key}`, JSON.stringify(value)); } catch { /* Scroll restoration is optional when storage is unavailable. */ }
}

function saveCurrentPosition(): void {
  savePosition(currentHistoryKey);
}

function installPositionTracking(): void {
  let frame: number | undefined;
  const update = () => {
    if (frame !== undefined) return;
    frame = window.requestAnimationFrame(() => {
      frame = undefined;
      saveCurrentPosition();
    });
  };
  const beforePop = () => {
    if (frame !== undefined) window.cancelAnimationFrame(frame);
    frame = undefined;
    saveCurrentPosition();
  };
  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('popstate', beforePop);
}

function restorePagePosition(type: PageChangeDetail['navigationType'], locationKey: string, hash: string): void {
  const saved = type === 'POP' ? readPosition(locationKey) : null;
  if (saved) {
    window.scrollTo({ left: saved.x, top: saved.y, behavior: 'instant' });
    const target = saved.focusId ? document.getElementById(saved.focusId) : null;
    if (target instanceof HTMLElement) focusWithoutScroll(target);
    return;
  }

  if (hash) {
    let id = hash.slice(1);
    try { id = decodeURIComponent(id); } catch { /* Use the original fragment when it is malformed. */ }
    const target = document.getElementById(id);
    if (target) {
      target.scrollIntoView({ block: 'start', behavior: 'instant' });
      if (target instanceof HTMLElement) focusWithoutScroll(target);
      return;
    }
  }
  window.scrollTo({ left: 0, top: 0, behavior: 'instant' });
  const heading = document.querySelector<HTMLElement>('#blex-route-content h1, #blex-route-content [data-page-title], #blex-route-content main');
  if (heading) focusWithoutScroll(heading);
}

function focusWithoutScroll(element: HTMLElement): void {
  if (!element.hasAttribute('tabindex') && !/^(?:A|BUTTON|INPUT|SELECT|TEXTAREA)$/.test(element.tagName)) {
    element.tabIndex = -1;
    element.dataset.blexRouteFocus = '';
  }
  try { element.focus({ preventScroll: true }); } catch { element.focus(); }
}

function disposeActivePage(): void {
  pageModuleGeneration += 1;
  for (const controller of activePostRequests) controller.abort();
  activePostRequests.clear();
  const cleanup = currentPageCleanup;
  currentPageCleanup = null;
  try { cleanup?.(); } catch (error) { console.error('A BLEX page module failed to clean up.', error); }
}

function permittedPageModuleUrl(module: ApplicationDocument['pageModules'][number], pageUrl: string): URL | null {
  let url: URL;
  try { url = new URL(module.source, pageUrl); } catch { return null; }
  if (url.origin !== window.location.origin || !['http:', 'https:'].includes(url.protocol) || url.search || url.hash) return null;
  const alias = url.pathname === '/assets/blex/' + module.name + '.js';
  const manifestAsset = url.pathname.startsWith('/assets/ui/') &&
    !url.pathname.includes('..') && /^\/assets\/ui\/[A-Za-z0-9._/-]+\.m?js$/i.test(url.pathname);
  return alias || manifestAsset ? url : null;
}

async function mountPageModules(
  page: ApplicationDocument,
  content: ParentNode,
  generation: number,
): Promise<(() => void) | null> {
  const cleanups: Array<() => void> = [];
  for (const source of page.pageModules) {
    const url = permittedPageModuleUrl(source, page.url);
    if (!url) continue;
    try {
      const module = await import(/* @vite-ignore */ url.href) as { mountPage?: (scope: ParentNode) => void | (() => void) };
      if (generation !== pageModuleGeneration) break;
      if (typeof module.mountPage !== 'function') continue;
      const cleanup = module.mountPage(content);
      if (typeof cleanup === 'function') cleanups.push(cleanup);
    } catch (error) {
      if (generation === pageModuleGeneration) console.error('A BLEX page module could not be mounted.', error);
    }
  }
  if (generation !== pageModuleGeneration) {
    cleanupAll(cleanups);
    return null;
  }
  return cleanups.length ? () => cleanupAll(cleanups) : null;
}

interface HcaptchaApi {
  render(element: HTMLElement, options: { sitekey: string }): string;
  remove?(widgetId: string): void;
}

const hcaptchaScriptUrl = 'https://js.hcaptcha.com/1/api.js';
let hcaptchaApiPromise: Promise<HcaptchaApi> | null = null;

function getHcaptchaApi(): HcaptchaApi | undefined {
  return (window as Window & { hcaptcha?: HcaptchaApi }).hcaptcha;
}

function isHcaptchaScript(script: HTMLScriptElement): boolean {
  try {
    const url = new URL(script.getAttribute('src') ?? '', window.location.href);
    return url.href === hcaptchaScriptUrl;
  } catch { return false; }
}

function loadHcaptchaApi(): Promise<HcaptchaApi> {
  const ready = getHcaptchaApi();
  if (ready?.render) return Promise.resolve(ready);
  if (hcaptchaApiPromise) return hcaptchaApiPromise;

  hcaptchaApiPromise = new Promise<HcaptchaApi>((resolve, reject) => {
    let script = Array.from(document.scripts).find((candidate) =>
      candidate.dataset.blexTrustedScript === 'hcaptcha' && isHcaptchaScript(candidate));
    if (!script) {
      script = document.createElement('script');
      script.src = hcaptchaScriptUrl;
      script.async = true;
      script.defer = true;
      script.dataset.blexTrustedScript = 'hcaptcha';
      document.head.append(script);
    }

    let settled = false;
    const finish = (api?: HcaptchaApi, error?: Error) => {
      if (settled) return;
      settled = true;
      window.clearInterval(poll);
      window.clearTimeout(timeout);
      script?.removeEventListener('error', failed);
      if (api?.render) resolve(api);
      else reject(error ?? new Error('hCaptcha did not become available.'));
    };
    const failed = () => finish(undefined, new Error('hCaptcha could not be loaded.'));
    const poll = window.setInterval(() => {
      const api = getHcaptchaApi();
      if (api?.render) finish(api);
    }, 50);
    const timeout = window.setTimeout(() => finish(undefined, new Error('hCaptcha took too long to load.')), 20_000);
    script?.addEventListener('error', failed, { once: true });
    const api = getHcaptchaApi();
    if (api?.render) finish(api);
  }).catch((error: unknown) => {
    hcaptchaApiPromise = null;
    throw error;
  });
  return hcaptchaApiPromise;
}

async function mountHcaptcha(
  page: ApplicationDocument,
  content: ParentNode,
  generation: number,
): Promise<(() => void) | null> {
  if (!page.needsHcaptcha) return null;
  const api = await loadHcaptchaApi();
  if (generation !== pageModuleGeneration || currentDocument !== page) return null;
  const mounted: Array<{ element: HTMLElement; widgetId: string }> = [];
  for (const element of content.querySelectorAll<HTMLElement>('[data-blex-hcaptcha-widget]')) {
    if (element.dataset.hcaptchaWidgetId || element.querySelector('iframe')) continue;
    const sitekey = element.dataset.sitekey?.trim();
    if (!sitekey) continue;
    try {
      const widgetId = api.render(element, { sitekey });
      element.dataset.hcaptchaWidgetId = widgetId;
      mounted.push({ element, widgetId });
    } catch (error) {
      console.error('The hCaptcha widget could not be rendered.', error);
    }
  }
  if (!mounted.length) return null;
  return () => {
    for (const { element, widgetId } of mounted.reverse()) {
      try { api.remove?.(widgetId); } catch { /* The widget may already have been removed with its route. */ }
      delete element.dataset.hcaptchaWidgetId;
    }
  };
}

function cleanupAll(cleanups: Array<() => void>): void {
  for (const cleanup of cleanups.reverse()) {
    try { cleanup(); } catch (error) { console.error('A BLEX page module failed to clean up.', error); }
  }
}

async function activateRouteFeatures(
  page: ApplicationDocument,
  content: ParentNode,
  generation: number,
): Promise<(() => void) | null> {
  const cleanups: Array<() => void> = [];
  const moduleCleanup = await mountPageModules(page, content, generation);
  if (moduleCleanup) cleanups.push(moduleCleanup);
  if (generation !== pageModuleGeneration || currentDocument !== page) {
    cleanupAll(cleanups);
    return null;
  }
  try {
    const captchaCleanup = await mountHcaptcha(page, content, generation);
    if (captchaCleanup) cleanups.push(captchaCleanup);
  } catch (error) {
    if (generation === pageModuleGeneration) console.error('The hCaptcha widget could not be initialized.', error);
  }
  if (generation !== pageModuleGeneration || currentDocument !== page) {
    cleanupAll(cleanups);
    return null;
  }
  return cleanups.length ? () => cleanupAll(cleanups) : null;
}

function ApplicationRoute() {
  const page = useLoaderData() as ApplicationDocument;
  const location = useLocation();
  const navigationType = useNavigationType();

  useLayoutEffect(() => {
    const initial = !hasCommittedInitialDocument;
    const navigated = !initial && location.key !== currentHistoryKey;
    const previousUrl = currentDocument?.url ?? page.url;
    currentDocument = page;
    currentHistoryKey = location.key;
    applyDocumentState(page, initial);
    const content = document.getElementById('blex-route-content');
    if (content) {
      if (navigated) restorePagePosition(navigationType, location.key, location.hash);
      const generation = ++pageModuleGeneration;
      void activateRouteFeatures(page, content, generation).then((cleanup) => {
        if (generation !== pageModuleGeneration || currentDocument !== page) {
          cleanup?.();
          return;
        }
        currentPageCleanup = cleanup;
        dispatchLifecycle('blex:page-change', {
          from: previousUrl,
          to: page.url,
          navigationType,
        });
      });
    }
    hasCommittedInitialDocument = true;
  }, [page, location.key, location.hash, navigationType]);

  return <ApplicationFrame view={page.view} />;
}

function ApplicationErrorBoundary() {
  const error = useRouteError();
  useEffect(() => {
    const url = error instanceof NativeNavigationRequired ? error.url : window.location.href;
    window.location.assign(url);
  }, [error]);
  const fallback = currentDocument ?? initialDocument;
  return fallback ? <ApplicationFrame view={fallback.view} /> : null;
}

const appRoot = document.getElementById('blex-application');
const initialDocument = readApplicationDocument(document, window.location.href);

if (appRoot && initialDocument) {
  history.scrollRestoration = 'manual';
  const appRouter = createBrowserRouter([{
    id: 'application',
    path: '*',
    loader: loadApplicationDocument,
    Component: ApplicationRoute,
    ErrorBoundary: ApplicationErrorBoundary,
  }], {
    hydrationData: { loaderData: { application: initialDocument } },
  });
  router = appRouter;

  document.addEventListener('blex:navigate', dispatchNavigateEvent);
  document.addEventListener('click', handleDocumentClick);
  document.addEventListener('submit', handleDocumentSubmit);
  installPositionTracking();
  hydrateRoot(appRoot, <RouterProvider router={appRouter} />, {
    onRecoverableError(error) { console.error('BLEX application hydration recovered from an error.', error); },
  });
} else {
  console.error('BLEX client routing was skipped because the application document marker is missing.');
}
