import { ui } from '../i18n/public-ui.js';
import { activateDocumentLocale, activateLocale, normalizeLocale } from '../i18n';
import { flushSync } from 'react-dom';
import { hydrateRoot } from 'react-dom/client';
import {
    createBrowserHistory,
    createRootRoute,
    createRoute,
    createRouter,
    type RouterHistory
} from '@tanstack/react-router';
import { use, useEffect, useLayoutEffect, useState } from 'react';
import { ApplicationFrame, type ApplicationView } from './frame.js';
import { openLoginPromptFrom } from './login-prompt.js';
import { opensOutsideApplication, type BlexNavigateDetail } from './navigation.js';
import { postBodySelector, postPageDataSelector } from './route-data.js';
import type { SiteHeaderProps } from '../appearance/shell.js';
import type { PostPageData } from '../features/posts/post-page-data';

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

interface ScreenData {
    configuration: unknown;
    globals: Record<string, unknown>;
}

interface ApplicationDocument {
    view: ApplicationView;
    url: string;
    head: PageHead;
    bodyAttributes: Array<[string, string]>;
    pageModules: Array<{ name: 'login' | 'editor' | 'screen'; source: string }>;
    needsHcaptcha: boolean;
    screen: ScreenData | null;
    post: PostDocument | null;
}

/** A post's client data and the sanitized body read back from the server markup. */
interface PostDocument {
    data: PostPageData;
    bodyHtml: string;
    revision: number;
    /** True once this document's post page has committed in the React tree. */
    mounted: boolean;
    /** Resolves when the page has mounted or can no longer mount. */
    settled: Promise<void>;
    settle: () => void;
}

type PostPageComponent = typeof import('../features/posts/post-page')['PostPage'];

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
let router: ApplicationRouter | null = null;
let navigationType: PageChangeDetail['navigationType'] = 'PUSH';
let showApplicationPage: ((view: ApplicationView) => void) | null = null;
let visitingFromApplication = false;
let screenGlobalNames: string[] = [];
let postRevision = 0;
let postPageRequest: Promise<PostPageComponent> | null = null;
const postPageWaitMs = 3000;
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
    try {
        value = JSON.parse(serialized);
    } catch {
        return undefined;
    }
    if (value === null) return null;
    if (!isRecord(value)) return undefined;

    if (value.brand !== undefined && value.brand !== null) {
        if (
            !isRecord(value.brand) ||
            typeof value.brand.siteName !== 'string' ||
            !isOptionalString(value.brand.logoUrl) ||
            !isOptionalString(value.brand.darkLogoUrl)
        )
            return undefined;
    }
    if (value.viewer !== undefined && value.viewer !== null) {
        if (
            !isRecord(value.viewer) ||
            !isOptionalString(value.viewer.username) ||
            !isOptionalString(value.viewer.csrfToken) ||
            ![value.viewer.hasEditorRole, value.viewer.isStaff].every(
                (entry) => entry === undefined || typeof entry === 'boolean'
            ) ||
            !(
                value.viewer.unreadCount === undefined ||
                (typeof value.viewer.unreadCount === 'number' && Number.isFinite(value.viewer.unreadCount))
            )
        )
            return undefined;
    }
    if (
        ![value.searchPage, value.editorPage, value.hideAuthLinks].every(
            (entry) => entry === undefined || typeof entry === 'boolean'
        )
    )
        return undefined;
    return value as SiteHeaderProps;
}

function attributesOf(element: Element, exclude: ReadonlySet<string> = new Set()): Array<[string, string]> {
    return Array.from(element.attributes)
        .filter(
            (attribute) => !exclude.has(attribute.name.toLowerCase()) && !attribute.name.toLowerCase().startsWith('on')
        )
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
            return (
                rel.has('stylesheet') ||
                rel.has('canonical') ||
                rel.has('alternate') ||
                rel.has('icon') ||
                rel.has('apple-touch-icon') ||
                rel.has('mask-icon')
            );
        })
        .map((link) => ({ attributes: normalizedLinkAttributes(link, pageUrl) }));
    const styles = Array.from(source.head.querySelectorAll<HTMLStyleElement>('style')).map((style) => ({
        text: style.textContent ?? '',
        nonce: style.nonce || undefined
    }));
    const scripts = Array.from(
        source.head.querySelectorAll<HTMLScriptElement>('script[type="application/ld+json"]')
    ).map((script) => ({
        attributes: attributesOf(script, new Set(['src', routeHeadAttribute])),
        text: script.textContent ?? ''
    }));
    return {
        title: source.title,
        lang: source.documentElement.lang,
        metas,
        links,
        styles,
        scripts
    };
}

function hasTrustedHcaptchaScript(source: Document, pageUrl: URL): boolean {
    return Array.from(
        source.querySelectorAll<HTMLScriptElement>('script[data-blex-trusted-script="hcaptcha"][src]')
    ).some((script) => {
        try {
            const url = new URL(script.getAttribute('src') ?? '', pageUrl);
            return url.origin === 'https://js.hcaptcha.com' && url.pathname === '/1/api.js' && !url.search && !url.hash;
        } catch {
            return false;
        }
    });
}

function pageModuleSources(source: Document): ApplicationDocument['pageModules'] {
    return Array.from(source.querySelectorAll<HTMLScriptElement>('script[data-blex-page-module]'))
        .map((script): ApplicationDocument['pageModules'][number] | null => {
            const name = script.dataset.blexPageModule;
            const src = script.getAttribute('src');
            if ((name !== 'login' && name !== 'editor' && name !== 'screen') || !src) return null;
            return {
                name,
                source: src
            };
        })
        .filter((entry): entry is ApplicationDocument['pageModules'][number] => entry !== null);
}

function bodyAttributes(source: Document): Array<[string, string]> {
    return source.body ? attributesOf(source.body) : [];
}

function readScriptJson(source: Document, id: string): unknown {
    return parseElementJson(source.getElementById(id));
}

function parseElementJson(element: Element | null): unknown {
    const text = element?.textContent;
    if (!text) return undefined;
    try {
        return JSON.parse(text);
    } catch {
        return undefined;
    }
}

function readScreenData(source: Document, content: Element): ScreenData | null {
    if (!content.querySelector('[data-screen]')) return null;
    const globals = readScriptJson(source, 'blex-screen-globals');
    return {
        configuration: readScriptJson(source, 'blex-screen-config'),
        globals: isRecord(globals) ? globals : {}
    };
}

function applyScreenData(screen: ScreenData | null): void {
    const target = window as unknown as Record<string, unknown>;
    for (const name of screenGlobalNames) delete target[name];
    screenGlobalNames = screen ? Object.keys(screen.globals) : [];
    if (screen) {
        target.configuration = screen.configuration;
        Object.assign(target, screen.globals);
    } else {
        delete target.configuration;
    }
}

function readPostDocument(source: Document, content: Element): PostDocument | null {
    const data = parseElementJson(source.querySelector(postPageDataSelector));
    const body = content.querySelector(postBodySelector);
    if (!isRecord(data) || typeof data.postPath !== 'string' || !body) return null;
    postRevision += 1;
    let settle = () => {};
    const settled = new Promise<void>((resolve) => {
        settle = resolve;
    });
    return {
        data: data as unknown as PostPageData,
        bodyHtml: body.innerHTML,
        revision: postRevision,
        mounted: false,
        settled,
        settle
    };
}

function loadPostPage(): Promise<PostPageComponent> {
    postPageRequest ??= import('../features/posts/post-page').then(
        ({ PostPage }) => PostPage,
        (error: unknown) => {
            postPageRequest = null;
            throw error;
        }
    );
    return postPageRequest;
}

function PostRoute({ post, PostPage }: { post: PostDocument; PostPage: PostPageComponent }) {
    useEffect(() => {
        post.mounted = true;
        post.settle();
    }, [post]);

    return <PostPage data={post.data} bodyHtml={post.bodyHtml} revision={post.revision} />;
}

function LoadingPostRoute({ post, loading }: { post: PostDocument; loading: Promise<PostPageComponent> }) {
    return <PostRoute post={post} PostPage={use(loading)} />;
}

/** The first post hydrates whenever its code arrives, so the router and header never wait for it. */
function hydratePostWhenLoaded(page: ApplicationDocument): void {
    const { post } = page;
    if (!post) return;
    const request = loadPostPage();
    // A rejection must not reach React, which would discard the readable server markup.
    const loading = request.catch(() => new Promise<PostPageComponent>(() => {}));
    page.view = {
        ...page.view,
        content: <LoadingPostRoute post={post} loading={loading} />
    };
    request.catch((error: unknown) => {
        console.error('The post page could not be loaded.', error);
        if (currentDocument && currentDocument !== page) return;
        page.view = {
            ...page.view,
            content: undefined
        };
        showApplicationPage?.(page.view);
        post.settle();
    });
}

/** After a navigation, a post that cannot load in time stays as server markup and ignores its late code. */
async function preparePostContent(page: ApplicationDocument): Promise<void> {
    const { post } = page;
    if (!post || page.view.content !== undefined) return;
    let timer: number | undefined;
    const PostPage = await Promise.race([
        loadPostPage().catch((error: unknown) => {
            console.error('The post page could not be loaded.', error);
            return null;
        }),
        new Promise<null>((resolve) => {
            timer = window.setTimeout(() => resolve(null), postPageWaitMs);
        })
    ]);
    window.clearTimeout(timer);
    if (!PostPage) return;
    page.view = {
        ...page.view,
        html: '',
        content: <PostRoute post={post} PostPage={PostPage} />
    };
}

/** Hands browser-only prompts back to the site script when this document's post page did not mount. */
async function announceUnmountedPost(page: ApplicationDocument): Promise<void> {
    const { post } = page;
    if (!post) return;
    if (page.view.content !== undefined) {
        await Promise.race([
            post.settled,
            new Promise((resolve) => {
                window.setTimeout(resolve, postPageWaitMs);
            })
        ]);
    }
    // A page about to be replaced leaves the one-time prompt for the next document.
    const replacing = activePostRequests.size > 0 || router?.state.isLoading;
    if (currentDocument === page && !post.mounted && !replacing)
        document.dispatchEvent(new CustomEvent('blex:post-page-unmounted'));
}

function readApplicationDocument(source: Document, url: string): ApplicationDocument | null {
    if (!source.head.querySelector('meta[name="blex-application"][content="1"]')) return null;
    const root = source.getElementById('blex-application');
    const content = source.getElementById('blex-route-content');
    const header = parseHeader(root?.dataset.header);
    if (!root || !content || header === undefined) return null;

    let pageUrl: URL;
    try {
        pageUrl = new URL(url, window.location.href);
    } catch {
        return null;
    }
    const screen = readScreenData(source, content);
    const post = readPostDocument(source, content);
    return {
        view: {
            header,
            html: content.innerHTML,
            contentKey: post ? `post:${post.data.postPath}` : screen ? pageRequestKey(pageUrl) : undefined
        },
        url: pageUrl.href,
        head: collectHead(source, pageUrl),
        bodyAttributes: bodyAttributes(source),
        pageModules: pageModuleSources(source),
        needsHcaptcha: hasTrustedHcaptchaScript(source, pageUrl),
        screen,
        post
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

async function loadApplicationDocument({
    abortController
}: {
    abortController: AbortController;
}): Promise<ApplicationDocument> {
    if (!hasCommittedInitialDocument && initialDocument) return initialDocument;
    const { signal } = abortController;
    const href = router?.history.location.href ?? window.location.href;
    let requestUrl: URL;
    try {
        requestUrl = new URL(href, window.location.href);
    } catch {
        return requiredNavigation(href);
    }
    saveCurrentPosition();
    const staged = stagedDocuments.get(pageRequestKey(requestUrl));
    if (staged) {
        stagedDocuments.delete(pageRequestKey(requestUrl));
        await Promise.all([preparePostContent(staged), loadPageStylesheets(staged)]);
        if (signal.aborted) throw new DOMException('Navigation was cancelled.', 'AbortError');
        beginPageChange(staged.url);
        return staged;
    }

    let response: Response;
    try {
        response = await fetch(requestUrl.href, {
            method: 'GET',
            credentials: 'same-origin',
            redirect: 'follow',
            signal,
            headers: {
                Accept: 'text/html,application/xhtml+xml',
                'X-Blex-Application-Request': '1'
            }
        });
    } catch (error) {
        if (signal.aborted) throw error;
        return requiredNavigation(requestUrl.href);
    }
    if (signal.aborted) throw new DOMException('Navigation was cancelled.', 'AbortError');

    const finalUrl = new URL(response.url || requestUrl.href, requestUrl);
    if (finalUrl.origin !== window.location.origin) return requiredNavigation(finalUrl.href);
    if (!response.ok && response.status !== 404) return requiredNavigation(finalUrl.href);
    const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
    if (contentType && !contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
        return requiredNavigation(finalUrl.href);
    }

    const markup = await response.text();
    if (signal.aborted) throw new DOMException('Navigation was cancelled.', 'AbortError');
    const parsed = new DOMParser().parseFromString(markup, 'text/html');
    const page = readApplicationDocument(parsed, finalUrl.href);
    if (!page) return requiredNavigation(finalUrl.href);

    if (response.redirected && !sameRoute(finalUrl, requestUrl)) {
        const redirected = new URL(finalUrl.href);
        if (!redirected.hash) redirected.hash = requestUrl.hash;
        // The address bar already shows the requested URL, so the redirect target takes over its history entry.
        stagedDocuments.set(pageRequestKey(redirected), page);
        abortController.abort();
        visit(redirected.pathname + redirected.search + redirected.hash, true);
        throw new DOMException('Navigation was redirected.', 'AbortError');
    }

    await Promise.all([preparePostContent(page), loadPageStylesheets(page)]);
    if (signal.aborted) throw new DOMException('Navigation was cancelled.', 'AbortError');
    beginPageChange(page.url);
    return page;
}

function beginPageChange(to: string): void {
    dispatchLifecycle('blex:before-page-change', {
        from: currentDocument?.url ?? window.location.href,
        to,
        navigationType
    });
    disposeActivePage();
}

// History paths go in directly because a router destination would read a `$` segment as a route parameter.
function visit(path: string, replace = false): void {
    visitingFromApplication = true;
    try {
        if (replace) router?.history.replace(path);
        else router?.history.push(path);
    } finally {
        visitingFromApplication = false;
    }
}

function screenScope(pathname: string): string | null {
    if (/^\/(?:settings|admin-settings)(?:\/|$)/.test(pathname)) return 'settings';
    if (/^\/search\/?$/.test(pathname)) return 'search';
    if (/^\/sign\/?$/.test(pathname)) return 'sign';
    return null;
}

// Settings owns its own routes. Search and signup only own the URL changes they make themselves.
function staysInActiveScreen(pathname: string): boolean {
    if (!currentDocument?.screen) return false;
    const scope = screenScope(pathname);
    if (!scope || scope !== screenScope(new URL(currentDocument.url).pathname)) return false;
    return scope === 'settings' || !visitingFromApplication;
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
    document.dispatchEvent(
        new CustomEvent<PageChangeDetail>(name, {
            bubbles: true,
            detail
        })
    );
}

function markExistingRouteHead(): void {
    const selectors = [
        'link[rel~="stylesheet"]:not([data-blex-theme])',
        'link[rel~="canonical"]',
        'link[rel~="alternate"]',
        'link[rel~="icon"]',
        'link[rel~="apple-touch-icon"]',
        'link[rel~="mask-icon"]',
        'meta[name]:not([name="blex-application"]):not([name="viewport"])',
        'meta[property]',
        'style',
        'script[type="application/ld+json"]'
    ];
    for (const element of document.head.querySelectorAll(selectors.join(',')))
        element.setAttribute(routeHeadAttribute, '');
}

function stylesheetHref(link: HeadLink): string | null {
    const attributes = new Map(link.attributes.map(([name, value]) => [name.toLowerCase(), value]));
    return attributes.get('rel')?.toLowerCase().split(/\s+/).includes('stylesheet')
        ? (attributes.get('href') ?? null)
        : null;
}

function createHeadLink(link: HeadLink): HTMLLinkElement {
    const node = document.createElement('link');
    for (const [name, value] of link.attributes) node.setAttribute(name, value);
    node.setAttribute(routeHeadAttribute, '');
    return node;
}

// New styles finish loading before the page swaps, so a screen never appears unstyled.
async function loadPageStylesheets(page: ApplicationDocument): Promise<void> {
    const present = new Set(
        Array.from(document.head.querySelectorAll<HTMLLinkElement>('link[rel~="stylesheet"]')).map((link) => link.href)
    );
    const loading = page.head.links
        .filter((link) => {
            const href = stylesheetHref(link);
            return href !== null && !present.has(href);
        })
        .map(
            (link) =>
                new Promise<void>((resolve) => {
                    const node = createHeadLink(link);
                    node.addEventListener('load', () => resolve(), { once: true });
                    node.addEventListener('error', () => resolve(), { once: true });
                    document.head.append(node);
                })
        );
    if (!loading.length) return;
    await Promise.race([Promise.all(loading), new Promise((resolve) => window.setTimeout(resolve, 3000))]);
}

function appendRouteHead(head: PageHead): void {
    const nextStylesheets = new Set(head.links.map(stylesheetHref));
    const keptStylesheets = new Set<string>();
    for (const node of document.head.querySelectorAll(`[${routeHeadAttribute}]`)) {
        if (
            node instanceof HTMLLinkElement &&
            node.relList.contains('stylesheet') &&
            nextStylesheets.has(node.href) &&
            !keptStylesheets.has(node.href)
        ) {
            keptStylesheets.add(node.href);
            continue;
        }
        node.remove();
    }
    for (const meta of head.metas) {
        const node = document.createElement('meta');
        for (const [name, value] of meta.attributes) node.setAttribute(name, value);
        node.setAttribute(routeHeadAttribute, '');
        document.head.append(node);
    }
    for (const link of head.links) {
        const href = stylesheetHref(link);
        if (href === null || !keptStylesheets.has(href)) document.head.append(createHeadLink(link));
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
        if (!preserve.has(attribute.name) && !nextAttributes.has(attribute.name))
            document.body.removeAttribute(attribute.name);
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
    try {
        target = new URL(detail.to, window.location.href);
    } catch {
        return;
    }
    if (!isInternalApplicationUrl(target)) return;
    if (sameRoute(target, new URL(window.location.href)) && target.hash === window.location.hash) return;
    if (!router) return;

    event.preventDefault();
    saveCurrentPosition();
    visit(`${target.pathname}${target.search}${target.hash}`, detail.replace);
}

const excludedFileExtension =
    /\.(?:css|m?js|map|png|jpe?g|gif|webp|avif|svg|ico|woff2?|ttf|otf|eot|pdf|zip|gz|mp3|mp4|webm|json|txt|xml|webmanifest|md)$/i;

function isInternalApplicationUrl(url: URL): boolean {
    if (url.origin !== window.location.origin || !['http:', 'https:'].includes(url.protocol)) return false;
    if (/^\/(?:assets|resources|images|media|api|docs)(?:\/|$)/i.test(url.pathname)) return false;
    if (/^\/write\/?$/i.test(url.pathname) || /^\/@[^/]+\/[^/]+\/(?:edit|timelapse)\/?$/i.test(url.pathname))
        return false;
    if (excludedFileExtension.test(url.pathname)) return false;
    if (/^\/login\/(?:start|callback)(?:\/|$)/i.test(url.pathname) || /^\/oauth(?:\/|$)/i.test(url.pathname))
        return false;
    return true;
}

function shouldLeaveLinkNative(anchor: HTMLAnchorElement): boolean {
    if (
        anchor.hasAttribute('download') ||
        anchor.hasAttribute('data-no-spa') ||
        anchor.hasAttribute('data-blex-native-navigation')
    )
        return true;
    const target = anchor.getAttribute('target');
    if (target && target.toLowerCase() !== '_self') return true;
    if (anchor.relList.contains('external')) return true;
    return false;
}

function handleDocumentClick(event: MouseEvent): void {
    if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
    )
        return;
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
    try {
        destination = new URL(anchor.href, window.location.href);
    } catch {
        return;
    }
    if (!isInternalApplicationUrl(destination)) return;
    const current = new URL(window.location.href);
    if (sameRoute(destination, current) && destination.hash !== current.hash) return;
    if (destination.href === current.href) return;
    if (!router) return;

    event.preventDefault();
    saveCurrentPosition();
    visit(`${destination.pathname}${destination.search}${destination.hash}`);
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
    if ((submitter instanceof HTMLButtonElement || submitter instanceof HTMLInputElement) && submitter.type === 'image')
        return;
    // Named controls can shadow form properties such as action.
    const method = (submitter?.getAttribute('formmethod') ?? form.getAttribute('method') ?? 'get').toLowerCase();
    const enctype = (
        submitter?.getAttribute('formenctype') ??
        form.getAttribute('enctype') ??
        'application/x-www-form-urlencoded'
    ).toLowerCase();
    if (method !== 'get' && method !== 'post') return;

    const action = submitter?.getAttribute('formaction') ?? form.getAttribute('action') ?? '';
    let destination: URL;
    try {
        destination = new URL(action || window.location.href, window.location.href);
    } catch {
        return;
    }
    if (!isInternalApplicationUrl(destination)) return;

    if (method === 'post') {
        if (enctype !== 'application/x-www-form-urlencoded' && enctype !== 'multipart/form-data') return;
        const data = formPostData(form, submitter);
        if (
            enctype === 'application/x-www-form-urlencoded' &&
            Array.from(data.values()).some((value) => typeof value !== 'string')
        )
            return;
        const isFormRedirectEndpoint =
            /^\/v1\/comments(?:\/\d+)?\/?$/.test(destination.pathname) ||
            /^\/v1\/users\/@[^/]+\/subscription\/?$/.test(destination.pathname) ||
            /^\/v1\/setting\/(?:avatar|cover)\/?$/.test(destination.pathname);
        if (
            destination.pathname.startsWith('/v1/') &&
            (!isFormRedirectEndpoint || !isSafeFormReturnTo(data.get('returnTo')))
        )
            return;
        if (destination.pathname.startsWith('/api/')) return;
        if (!router) return;
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
        if (submitter.name && !submitter.disabled && submitter.type !== 'image')
            data.append(submitter.name, submitter.value);
    }
    const params = new URLSearchParams();
    for (const [name, value] of data.entries()) {
        if (typeof value !== 'string') return;
        params.append(name, value);
    }
    destination.search = params.toString();
    if (!router) return;

    event.preventDefault();
    saveCurrentPosition();
    visit(`${destination.pathname}${destination.search}${destination.hash}`);
}

function isSafeFormReturnTo(value: FormDataEntryValue | null): value is string {
    if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || value.includes('\\'))
        return false;
    try {
        const url = new URL(value, window.location.href);
        return (
            url.origin === window.location.origin &&
            !decodeURIComponent(url.pathname).startsWith('//') &&
            !url.pathname.startsWith('/v1/') &&
            !url.pathname.startsWith('/api/') &&
            isInternalApplicationUrl(url)
        );
    } catch {
        return false;
    }
}

function formPostData(form: HTMLFormElement, submitter: HTMLElement | null): FormData {
    const data = new FormData(form);
    if (submitter instanceof HTMLButtonElement || submitter instanceof HTMLInputElement) {
        if (submitter.name && !submitter.disabled && submitter.type !== 'image')
            data.append(submitter.name, submitter.value);
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
    const returnTo = data.get('returnTo');
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
    controller: AbortController
): Promise<void> {
    const headers: Record<string, string> = {
        Accept: 'text/html,application/xhtml+xml',
        ...csrfHeader(data)
    };
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
            signal: controller.signal
        });
        const finalUrl = new URL(response.url || action.href, action);
        if (finalUrl.origin !== window.location.origin) {
            showPostFeedback(form, ui('The response page does not belong to this site.'));
            return;
        }
        if (response.status === 204 || response.status === 205) {
            await activeRouter.invalidate();
            await renderLoadedPage(activeRouter);
            return;
        }
        const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
        if (contentType && !contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
            showPostFeedback(
                form,
                ui('Could not display the response page. Refresh to check whether your changes were saved.')
            );
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
            showPostFeedback(form, ui('Could not load the response page. Check whether your changes were saved.'));
            return;
        }

        stagedDocuments.set(pageRequestKey(new URL(page.url)), page);
        const currentUrl = new URL(window.location.href);
        if (sameRoute(currentUrl, finalUrl)) {
            if (currentUrl.hash !== finalUrl.hash) visit(finalUrl.pathname + finalUrl.search + finalUrl.hash);
            await activeRouter.invalidate();
            await renderLoadedPage(activeRouter);
        } else {
            visit(finalUrl.pathname + finalUrl.search + finalUrl.hash);
        }
    } catch (error) {
        if (controller.signal.aborted) return;
        console.error('An application form could not be submitted.', error);
        showPostFeedback(
            form,
            ui('Could not confirm the result. Check whether your changes were saved before trying again.')
        );
    }
}

function readPosition(key: string): PagePosition | null {
    try {
        const value: unknown = JSON.parse(sessionStorage.getItem(`${scrollStoragePrefix}${key}`) ?? 'null');
        if (
            !isRecord(value) ||
            typeof value.x !== 'number' ||
            typeof value.y !== 'number' ||
            typeof value.focusId !== 'string'
        )
            return null;
        return {
            x: value.x,
            y: value.y,
            focusId: value.focusId
        };
    } catch {
        return null;
    }
}

function savePosition(key: string): void {
    const focused = document.activeElement;
    const focusId = focused instanceof HTMLElement ? focused.id : '';
    const value: PagePosition = {
        x: window.scrollX,
        y: window.scrollY,
        focusId
    };
    try {
        sessionStorage.setItem(`${scrollStoragePrefix}${key}`, JSON.stringify(value));
    } catch {
        /* Scroll restoration is optional when storage is unavailable. */
    }
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
        window.scrollTo({
            left: saved.x,
            top: saved.y,
            behavior: 'instant'
        });
        const target = saved.focusId ? document.getElementById(saved.focusId) : null;
        if (target instanceof HTMLElement) focusWithoutScroll(target);
        return;
    }

    if (hash) {
        let id = hash.slice(1);
        try {
            id = decodeURIComponent(id);
        } catch {
            /* Use the original fragment when it is malformed. */
        }
        const target = document.getElementById(id);
        if (target) {
            target.scrollIntoView({
                block: 'start',
                behavior: 'instant'
            });
            if (target instanceof HTMLElement) focusWithoutScroll(target);
            return;
        }
    }
    window.scrollTo({
        left: 0,
        top: 0,
        behavior: 'instant'
    });
    const heading = document.querySelector<HTMLElement>(
        '#blex-route-content h1, #blex-route-content [data-page-title], #blex-route-content main'
    );
    if (heading) focusWithoutScroll(heading);
}

function focusWithoutScroll(element: HTMLElement): void {
    if (!element.hasAttribute('tabindex') && !/^(?:A|BUTTON|INPUT|SELECT|TEXTAREA)$/.test(element.tagName)) {
        element.tabIndex = -1;
        element.dataset.blexRouteFocus = '';
    }
    try {
        element.focus({ preventScroll: true });
    } catch {
        element.focus();
    }
}

function disposeActivePage(): void {
    pageModuleGeneration += 1;
    for (const controller of activePostRequests) controller.abort();
    activePostRequests.clear();
    const cleanup = currentPageCleanup;
    currentPageCleanup = null;
    try {
        cleanup?.();
    } catch (error) {
        console.error('A BLEX page module failed to clean up.', error);
    }
}

function permittedPageModuleUrl(module: ApplicationDocument['pageModules'][number], pageUrl: string): URL | null {
    let url: URL;
    try {
        url = new URL(module.source, pageUrl);
    } catch {
        return null;
    }
    if (url.origin !== window.location.origin || !['http:', 'https:'].includes(url.protocol) || url.search || url.hash)
        return null;
    const alias = url.pathname === '/assets/blex/' + module.name + '.js';
    const manifestAsset =
        !url.pathname.includes('..') && /^\/assets\/(?:ui|web)\/[A-Za-z0-9._/-]+\.m?js$/i.test(url.pathname);
    return alias || manifestAsset ? url : null;
}

async function mountPageModules(
    page: ApplicationDocument,
    content: ParentNode,
    generation: number
): Promise<(() => void) | null> {
    const cleanups: Array<() => void> = [];
    for (const source of page.pageModules) {
        const url = permittedPageModuleUrl(source, page.url);
        if (!url) continue;
        try {
            const module = (await import(/* @vite-ignore */ url.href)) as {
                mountPage?: (scope: ParentNode) => undefined | (() => void);
            };
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
    } catch {
        return false;
    }
}

function loadHcaptchaApi(): Promise<HcaptchaApi> {
    const ready = getHcaptchaApi();
    if (ready?.render) return Promise.resolve(ready);
    if (hcaptchaApiPromise) return hcaptchaApiPromise;

    hcaptchaApiPromise = new Promise<HcaptchaApi>((resolve, reject) => {
        let script = Array.from(document.scripts).find(
            (candidate) => candidate.dataset.blexTrustedScript === 'hcaptcha' && isHcaptchaScript(candidate)
        );
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
        const timeout = window.setTimeout(
            () => finish(undefined, new Error('hCaptcha took too long to load.')),
            20_000
        );
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
    generation: number
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
            mounted.push({
                element,
                widgetId
            });
        } catch (error) {
            console.error('The hCaptcha widget could not be rendered.', error);
        }
    }
    if (!mounted.length) return null;
    return () => {
        for (const { element, widgetId } of mounted.reverse()) {
            try {
                api.remove?.(widgetId);
            } catch {
                /* The widget may already have been removed with its route. */
            }
            delete element.dataset.hcaptchaWidgetId;
        }
    };
}

function cleanupAll(cleanups: Array<() => void>): void {
    for (const cleanup of cleanups.reverse()) {
        try {
            cleanup();
        } catch (error) {
            console.error('A BLEX page module failed to clean up.', error);
        }
    }
}

async function activateRouteFeatures(
    page: ApplicationDocument,
    content: ParentNode,
    generation: number
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

function browserHistoryKey(): string {
    const state: unknown = window.history.state;
    return isRecord(state) && typeof state.__TSR_key === 'string' ? state.__TSR_key : 'default';
}

function commitApplicationPage(page: ApplicationDocument, hash: string): void {
    const initial = !hasCommittedInitialDocument;
    const key = browserHistoryKey();
    const navigated = !initial && key !== currentHistoryKey;
    if (!initial && page === currentDocument) {
        currentHistoryKey = key;
        // The browser already scrolled to a fragment link it followed by itself.
        if (navigated && !(key === 'default' && hash)) restorePagePosition(navigationType, key, hash);
        return;
    }

    const previousUrl = currentDocument?.url ?? page.url;
    const changeType = navigationType;
    currentDocument = page;
    currentHistoryKey = key;
    applyScreenData(page.screen);
    // Screens fill in after they mount, so the browser restores their scroll within the same document.
    history.scrollRestoration = page.screen ? 'auto' : 'manual';
    applyDocumentState(page, initial);
    const content = document.getElementById('blex-route-content');
    if (content) {
        if (navigated) restorePagePosition(changeType, key, hash);
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
                navigationType: changeType
            });
            void announceUnmountedPost(page);
        });
    }
    hasCommittedInitialDocument = true;
}

async function renderLoadedPage(activeRouter: ApplicationRouter): Promise<void> {
    const { matches } = activeRouter.state;
    const match = matches[matches.length - 1];
    if (match?.status === 'error') {
        // The failed destination already owns the current history entry.
        window.location.replace(
            match.error instanceof NativeNavigationRequired ? match.error.url : window.location.href
        );
        return;
    }
    const page = match?.status === 'success' ? (match.loaderData as ApplicationDocument | undefined) : undefined;
    if (!page) return;
    const isCurrentPage = () => activeRouter.state.matches[activeRouter.state.matches.length - 1]?.loaderData === page;
    try {
        await activateLocale(normalizeLocale(page.head.lang));
    } catch {
        if (isCurrentPage()) window.location.assign(page.url);
        return;
    }
    if (!isCurrentPage()) return;
    if (page.head.lang) document.documentElement.lang = page.head.lang;
    flushSync(() => showApplicationPage?.(page.view));
    commitApplicationPage(page, window.location.hash);
}

function ApplicationRoute({ initialPage }: { initialPage: ApplicationDocument }) {
    const [view, setView] = useState(initialPage.view);

    useLayoutEffect(() => {
        showApplicationPage = setView;
        // The post chunk may have failed while this first render was in progress.
        setView(initialPage.view);
        if (!hasCommittedInitialDocument) commitApplicationPage(initialPage, window.location.hash);
    }, [initialPage]);

    return <ApplicationFrame view={view} />;
}

declare global {
    interface Window {
        blexHistory?: RouterHistory;
    }
}

// React screens reuse this history so unsaved-change blockers also cover links in the site header.
function applicationHistory(): RouterHistory {
    window.blexHistory ??= createBrowserHistory();
    return window.blexHistory;
}

const rootRoute = createRootRoute();
const applicationRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '$',
    loaderDeps: ({ search }) => search,
    // A fragment change stays on the loaded page; saved forms still reload it through invalidate.
    shouldReload: ({ cause }) => cause !== 'stay',
    loader: loadApplicationDocument
});

const createApplicationRouter = () =>
    createRouter({
        routeTree: rootRoute.addChildren([applicationRoute]),
        history: applicationHistory(),
        trailingSlash: 'preserve',
        // Server-rendered query strings stay byte-for-byte instead of being reparsed as JSON values.
        parseSearch: (search) => ({ raw: search }),
        stringifySearch: (search) => (typeof search.raw === 'string' ? search.raw : ''),
        defaultStaleReloadMode: 'blocking',
        defaultGcTime: 0
    });
type ApplicationRouter = ReturnType<typeof createApplicationRouter>;

const appRoot = document.getElementById('blex-application');
const initialDocument = readApplicationDocument(document, window.location.href);

if (appRoot && initialDocument) {
    history.scrollRestoration = initialDocument.screen ? 'auto' : 'manual';
    const appRouter = createApplicationRouter();
    router = appRouter;
    hydratePostWhenLoaded(initialDocument);
    void activateDocumentLocale()
        .then(() => appRouter.load())
        .then(() => {
            // Most page bodies are server HTML, so this router owns history and loading while React renders one stable frame.
            appRouter.history.subscribe(({ location, action }) => {
                navigationType = action.type === 'PUSH' || action.type === 'REPLACE' ? action.type : 'POP';
                if (!appRouter.state.isLoading && staysInActiveScreen(location.pathname)) {
                    saveCurrentPosition();
                    queueMicrotask(() => {
                        currentHistoryKey = browserHistoryKey();
                    });
                    return;
                }
                void appRouter.load().then(() => renderLoadedPage(appRouter));
            });
            document.addEventListener('blex:navigate', dispatchNavigateEvent);
            document.addEventListener('click', handleDocumentClick);
            document.addEventListener('submit', handleDocumentSubmit);
            installPositionTracking();
            hydrateRoot(appRoot, <ApplicationRoute initialPage={initialDocument} />, {
                onRecoverableError(error) {
                    console.error('BLEX application hydration recovered from an error.', error);
                }
            });
        })
        .catch((error: unknown) => {
            console.error('BLEX could not start its client, so the page stays as server HTML.', error);
        });
} else {
    console.error('BLEX client routing was skipped because the application document marker is missing.');
}
