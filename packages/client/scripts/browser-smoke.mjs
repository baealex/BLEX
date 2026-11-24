import { chromium, expect } from '@playwright/test';
import { editorPublishingChecks } from './editor-publishing-smoke.mjs';

const origin = process.env.BLEX_SMOKE_URL ?? 'http://127.0.0.1:8040';
const setupToken = process.env.BLEX_SETUP_TOKEN;
const account = {
    username: 'smokeadmin',
    displayName: 'Smoke Admin',
    email: 'smoke@example.com',
    password: 'blex-Smoke-Test-2847!'
};

if (!setupToken) {
    console.error('Set BLEX_SETUP_TOKEN to the token of a new BLEX instance.');
    process.exit(1);
}

const failures = [];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

page.on('pageerror', (error) => failures.push(`Page error: ${error.message}`));
page.on('dialog', (dialog) => {
    if (dialog.type() === 'beforeunload') return dialog.accept();
    failures.push(`Unexpected ${dialog.type()}: ${dialog.message()}`);
    return dialog.dismiss();
});
page.on('response', (response) => {
    const type = response.request().resourceType();
    if (response.url().startsWith(origin) && response.status() >= 400 && ['script', 'stylesheet'].includes(type)) {
        failures.push(`${response.status()} ${new URL(response.url()).pathname}`);
    }
});

const open = (path) => page.goto(`${origin}${path}`, { waitUntil: 'networkidle' });

const createFirstAdmin = async () => {
    // The form is filled before its code arrives, and hydration has to keep every field.
    const setupModule = '**/assets/ui/assets/setup-page-*.js';
    const { promise: filled, resolve: release } = Promise.withResolvers();
    let continued;
    await page.route(setupModule, (route) => {
        continued = filled.then(() => route.continue());
        return continued;
    });
    try {
        await page.goto(`${origin}/setup?token=${encodeURIComponent(setupToken)}`, { waitUntil: 'commit' });
        await page.locator('input[name=username]').fill(account.username);
        await page.locator('input[name=displayName]').fill(account.displayName);
        await page.locator('input[name=email]').fill(account.email);
        await page.locator('input[name=password]').fill(account.password);
        await page.locator('input[name=passwordCheck]').fill(account.password);
    } finally {
        release();
        await continued;
        await page.unroute(setupModule);
    }
    await page.waitForLoadState('networkidle');
    await expect(page.locator('input[name=username]')).toHaveValue(account.username);
    await expect(page.locator('input[name=passwordCheck]')).toHaveValue(account.password);
    await page.getByRole('button', { name: '관리자 만들기' }).click();
    await page.waitForURL((url) => url.pathname !== '/setup');
};

const logOutFromAccountMenu = async () => {
    await open('/');
    const menu = page.locator('[data-account-menu]').first();
    await menu.locator('summary').click();
    await expect(menu.getByRole('link', { name: '설정' })).toBeVisible();
    await menu.getByRole('button', { name: '로그아웃' }).click();
    await expect(page.locator('[data-account-menu]')).toHaveCount(0);
};

const logIn = async () => {
    await open('/login');
    await page.locator('#blex-login-username').fill(account.username);
    const password = page.locator('input[type=password]').first();
    await password.fill(account.password);
    await password.press('Enter');
    await page.waitForURL((url) => url.pathname !== '/login');
};

const recoverFromFailedCatalog = async () => {
    const catalog = /\/messages[-.][^/]*\.js/;
    let documents = 0;
    const countDocument = (request) => {
        if (request.isNavigationRequest() && request.frame() === page.mainFrame()) documents += 1;
    };
    page.on('request', countDocument);
    await page.route(catalog, async (route) => {
        if (documents !== 1) return route.continue();
        const response = await route.fetch();
        // The header's text module can share the file name, so only a module exporting a catalog fails.
        if (/\bas messages\}/.test(await response.text())) return route.abort();
        return route.fulfill({ response });
    });
    try {
        await page.goto(`${origin}/tags`, { waitUntil: 'commit' });
        await expect.poll(() => documents).toBe(2);
        await page.waitForLoadState('networkidle');
        await page.evaluate(() => {
            window.__smokeSameDocument = true;
        });
        await page.locator('a[href="/"]').first().click();
        await page.waitForURL(`${origin}/`);
        expect(await page.evaluate(() => window.__smokeSameDocument)).toBe(true);
    } finally {
        page.off('request', countDocument);
        await page.unroute(catalog);
    }
};

const openMobileMenu = async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await open('/');
    await page.locator('[data-site-menu-open]').click();
    const menu = page.locator('#blex-mobile-menu');
    await expect(menu).toHaveJSProperty('open', true);
    await expect(menu.getByRole('link', { name: '설정' })).toBeVisible();
    await page.setViewportSize({ width: 1280, height: 900 });
};

const useSiteControlsBeforeHydration = async () => {
    const holding = async (pattern, path, check) => {
        const { promise: released, resolve: release } = Promise.withResolvers();
        let continued;
        await page.route(pattern, (route) => {
            continued = released.then(() => route.continue());
            return continued;
        });
        try {
            await page.goto(`${origin}${path}`, { waitUntil: 'commit' });
            await expect(page.locator('html')).toHaveAttribute('data-theme-preference', /.+/);
            await check();
        } finally {
            release();
            await continued;
            await page.unroute(pattern);
        }
        await page.waitForLoadState('networkidle');
    };
    await holding('**/assets/blex/app.js', '/', async () => {
        const menu = page.locator('[data-site-header] [data-account-menu]');
        await menu.locator('summary').click();
        await expect(menu).toHaveJSProperty('open', true);
        await page.keyboard.press('Escape');
        await expect(menu).toHaveJSProperty('open', false);
        const root = page.locator('html');
        const theme = await root.getAttribute('data-theme');
        const toggle = page.locator('[data-site-theme-toggle]:visible');
        await toggle.click();
        await expect(root).not.toHaveAttribute('data-theme', theme);
        await toggle.click();
        await expect(root).toHaveAttribute('data-theme', theme);
    });
    await page.context().clearCookies({ name: 'blex_theme' });
    await holding('**/assets/ui/assets/discovery-page-*.js', '/tags', async () => {
        // The site script titles the theme buttons once the header has hydrated.
        await expect(page.locator('[data-site-theme-toggle]').first()).toHaveAttribute('title', /.+/);
        const sort = page.locator('main [data-account-menu]');
        await sort.locator('summary').click();
        await expect(sort).toHaveJSProperty('open', true);
        await page.keyboard.press('Escape');
        await expect(sort).toHaveJSProperty('open', false);
    });
};

const keepPostMarkupWhenItsCodeFails = async () => {
    await open('/');
    const csrf = (await page.context().cookies()).find((cookie) => cookie.name === 'csrftoken')?.value;
    expect(csrf).toBeTruthy();
    const created = await (
        await page.request.post(`${origin}/v1/posts`, {
            headers: { origin, 'x-csrftoken': csrf },
            data: {
                title: 'Post page fallback',
                url: `post-page-fallback-${Date.now()}`,
                contentHtml: '<p>This post stays usable when its page code fails.</p>'
            }
        })
    ).json();
    expect(created.status).toBe('DONE');
    const postPath = `/@${account.username}/${created.body.url}`;
    const chunk = '**/assets/ui/assets/post-page-*.js';
    const { promise: released, resolve: release } = Promise.withResolvers();
    let failed;
    await page.route(chunk, (route) => {
        failed = released.then(() => route.abort());
        return failed;
    });
    const visitor = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    try {
        const loadFailed = page.waitForEvent('console', (message) =>
            message.text().includes('The page could not be loaded.')
        );
        await page.goto(`${origin}${postPath}`, { waitUntil: 'commit' });
        // The site script titles the theme buttons once the header has hydrated.
        await expect(page.locator('[data-site-theme-toggle]').first()).toHaveAttribute('title', /.+/);
        const comment = page.locator('textarea[name=commentMd]');
        const text = 'Typed before the page code failed';
        await comment.fill(text);
        const share = page.locator('.post-action-dock [data-account-menu]');
        await share.locator('summary').click();
        await expect(share).toHaveJSProperty('open', true);
        release();
        await loadFailed;
        await page.evaluate(
            () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
        );
        await expect(comment).toHaveValue(text);
        await expect(share).toHaveJSProperty('open', true);
        await page.keyboard.press('Escape');
        await expect(share).toHaveJSProperty('open', false);
        await page.getByRole('button', { name: '댓글 작성', exact: true }).click();
        await expect(page.locator('#post-comments')).toContainText(text);

        // A signed-out reader still gets the login prompt without the page code.
        await visitor.route(chunk, (route) => route.abort());
        await visitor.goto(`${origin}${postPath}`, { waitUntil: 'networkidle' });
        await visitor.locator('.post-action-dock [data-blex-login-prompt="like"]').click();
        await expect(visitor.locator('#blex-login-prompt')).toBeVisible();
        await expect(visitor).toHaveURL(`${origin}${postPath}`);
    } finally {
        release();
        await failed;
        await page.unroute(chunk);
        await visitor.close();
    }
};

const toasterChunk = '**/assets/ui/assets/toaster-*.js';

/** Fills a field, shows a toast whose code the route breaks, and checks that the page and the typed value stay. */
const keepDocumentWhenToastBreaks = async (field, value, showToast) => {
    const toaster = page.waitForRequest((request) => /\/toaster-[^/]*\.js$/.test(new URL(request.url()).pathname));
    await page.evaluate(() => {
        window.__smokeSameDocument = true;
        sessionStorage.removeItem('blex:catalog-reload');
    });
    await field.fill(value);
    await showToast();
    await toaster;
    // The first toasts wait up to a second for the toaster before they are dropped.
    await page.waitForTimeout(1200);
    await expect(page.locator('[data-sonner-toaster]')).toHaveCount(0);
    expect(await page.evaluate(() => window.__smokeSameDocument)).toBe(true);
    await expect(field).toHaveValue(value);
    await expect(page.locator('[data-site-header]')).toBeVisible();
};

const saveProfileBio = async () => {
    await open('/settings/profile');
    await expect(page.locator('[data-screen="SettingsApp"]')).toHaveAttribute('data-screen-status', 'mounted');
    return {
        bio: page.locator('[data-screen="SettingsApp"] textarea').first(),
        save: () => page.getByRole('button', { name: '기본 정보 저장', exact: true }).click()
    };
};

const keepUnsavedWorkWhenToastCodeFails = async () => {
    const drafts = '**/v1/drafts';
    // Failing saves keep the editor's edits unsaved while the toast code fails.
    await page.route(drafts, (route) => (route.request().method() === 'POST' ? route.abort() : route.continue()));
    // A tab opened before a deploy asks for a toaster file that is gone.
    await page.route(toasterChunk, (route) => route.abort());
    try {
        const profile = await saveProfileBio();
        await keepDocumentWhenToastBreaks(profile.bio, 'Typed before a toast failed', profile.save);

        await open('/write');
        const title = page.getByPlaceholder('제목을 입력하세요');
        await page.locator('.ProseMirror').click();
        await page.keyboard.insertText('Body typed before a toast failed');
        await keepDocumentWhenToastBreaks(title, 'Kept when a toast fails', () =>
            page.getByRole('button', { name: '임시 저장', exact: true }).click()
        );
        // A missing catalog leaves the page too while its unsaved edits would warn before leaving.
        await page.evaluate(() => document.dispatchEvent(new Event('blex:catalog-failed')));
        await expect(page.locator('.ProseMirror')).toContainText('Body typed before a toast failed');
        expect(await page.evaluate(() => window.__smokeSameDocument)).toBe(true);
    } finally {
        await page.unroute(toasterChunk);
        await page.unroute(drafts);
    }
};

const isolateToasterRenderError = async () => {
    await page.route(toasterChunk, (route) =>
        route.fulfill({
            contentType: 'text/javascript',
            body: 'export default function BrokenToaster() { throw new Error("smoke-toaster-render-error"); }'
        })
    );
    try {
        const profile = await saveProfileBio();
        await keepDocumentWhenToastBreaks(profile.bio, 'Typed before the toaster broke', profile.save);
        await expect(page.locator('[data-screen="SettingsApp"]')).toHaveAttribute('data-screen-status', 'mounted');
        // The application still moves between pages.
        await page.locator('[data-site-header] a[href="/"]').first().click();
        await expect(page).toHaveURL(`${origin}/`);
        expect(await page.evaluate(() => window.__smokeSameDocument)).toBe(true);
    } finally {
        await page.unroute(toasterChunk);
    }
};

const openEditor = async () => {
    await open('/write');
    await expect(page.getByPlaceholder('제목을 입력하세요')).toBeVisible();
    await page.locator('.ProseMirror').click();
    await page.keyboard.type('/');
    const search = page.getByPlaceholder('명령어 검색...');
    await expect(search).toBeFocused();
    await search.press('Tab');
    const command = page.getByRole('dialog').getByRole('button').first();
    await expect(command).toBeFocused();
    await command.press('Enter');
    await expect(search).toHaveCount(0);
};

const warnBeforeLeavingEditor = async () => {
    const drafts = '**/v1/drafts';
    const { promise: released, resolve: release } = Promise.withResolvers();
    // Holding the autosave keeps the title unsaved while the warning is checked.
    await page.route(drafts, async (route) => {
        if (route.request().method() !== 'POST') return route.continue();
        await released;
        return route.abort();
    });
    try {
        await open('/');
        await page.evaluate(() => {
            window.__smokeSameDocument = true;
        });
        await page.locator('[data-site-header] a[href="/write"]').first().click();
        const title = page.getByPlaceholder('제목을 입력하세요');
        await expect(title).toBeVisible();
        await expect(page).toHaveURL(`${origin}/write`);
        await title.fill('Unsaved title');
        const warning = page.getByRole('dialog', { name: '저장되지 않은 변경사항' });
        const home = page.locator('[data-site-header] a[href="/"]').first();
        await home.click();
        await expect(warning).toBeVisible();
        await warning.getByRole('button', { name: '취소', exact: true }).click();
        await expect(warning).toHaveCount(0);
        await page.goBack();
        await expect(warning).toBeVisible();
        await warning.getByRole('button', { name: '취소', exact: true }).click();
        await expect(page).toHaveURL(`${origin}/write`);
        await expect(title).toHaveValue('Unsaved title');
        await home.click();
        await warning.getByRole('button', { name: '나가기', exact: true }).click();
        await expect(page).toHaveURL(`${origin}/`);
        expect(await page.evaluate(() => window.__smokeSameDocument)).toBe(true);
    } finally {
        release();
        await page.unroute(drafts);
    }
};

const reactRoots = () =>
    page.evaluate(
        () =>
            [...document.querySelectorAll('*')].filter((element) =>
                Object.keys(element).some((key) => key.startsWith('__reactContainer$'))
            ).length
    );

const visitInApplication = (to) =>
    page.evaluate((to) => document.dispatchEvent(new CustomEvent('blex:navigate', { detail: { to } })), to);

/** The page still moves to another one in the same document. */
const keepsApplicationWorking = async () => {
    await page.evaluate(() => {
        window.__smokeSameDocument = true;
    });
    await page.locator('[data-site-header] a[href="/"]').first().click();
    await expect(page).toHaveURL(`${origin}/`);
    expect(await page.evaluate(() => window.__smokeSameDocument)).toBe(true);
    expect(await reactRoots()).toBe(1);
};

const screenDataScript = /(<script type="application\/json" id="blex-screen-page-data">)(.*?)(<\/script>)/s;
const scriptJson = (value) =>
    JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');

const rejectInvalidScreenData = async () => {
    const path = '/settings/profile';
    const screenPage = (url) => url.pathname === path;
    const cases = [
        {
            name: '<img data-bootstrap-injection="">',
            edit: (data) => ({ ...data, screen: { ...data.screen, name: '<img data-bootstrap-injection="">' } })
        },
        {
            name: 'SettingsApp',
            edit: (data) => ({ ...data, screen: { ...data.screen, props: { isEditor: false, isStaff: 'false' } } })
        },
        { name: 'MissingScreen', edit: (data) => ({ ...data, screen: { name: 'MissingScreen', props: {} } }) },
        { name: 'Screen', edit: () => '{' }
    ];
    for (const { name, edit } of cases) {
        // A server bug or a changed response sends data the screen cannot use.
        await page.route(screenPage, async (route) => {
            const response = await route.fetch();
            const body = (await response.text()).replace(screenDataScript, (_, start, json, end) => {
                const edited = edit(JSON.parse(json));
                return start + (typeof edited === 'string' ? edited : scriptJson(edited)) + end;
            });
            return route.fulfill({ response, body });
        });
        try {
            for (const arrive of [() => open(path), () => visitInApplication(path)]) {
                await arrive();
                const screen = page.locator('#blex-route-content [data-screen]');
                await expect(screen).toHaveAttribute('data-screen-status', 'error');
                await expect(screen).toHaveAttribute('data-screen-error', 'bootstrap_error');
                await expect(screen).toHaveText(`Component Error: ${name}`);
                await expect(page.locator('#blex-route-content img[data-bootstrap-injection]')).toHaveCount(0);
                await keepsApplicationWorking();
            }
        } finally {
            await page.unroute(screenPage);
        }
    }
};

const isolateScreenRenderError = async () => {
    // The search screen's own module, not the server's search page module.
    const searchChunk = /\/assets\/ui\/assets\/search-[\w-]{8}\.js$/;
    await page.route(searchChunk, (route) =>
        route.fulfill({
            contentType: 'text/javascript',
            body: 'export default function BrokenScreen() { throw new Error("smoke-screen-render-error"); }'
        })
    );
    try {
        await open('/search?q=smoke');
        const screen = page.locator('[data-screen="SearchPage"]');
        await expect(screen).toHaveAttribute('data-screen-status', 'error');
        await expect(screen).toHaveAttribute('data-screen-error', 'render_error');
        await expect(screen).toHaveText('Component Error: SearchPage');
        await expect(page.locator('[data-site-header]')).toBeVisible();
        await keepsApplicationWorking();
    } finally {
        await page.unroute(searchChunk);
    }
};

const renderScreensInApplicationRoot = async () => {
    await open('/');
    await page.evaluate(() => {
        window.__smokeSameDocument = true;
    });
    for (const path of ['/search?q=smoke', '/settings/profile', '/admin-settings/site-settings', '/write']) {
        await visitInApplication(path);
        await expect(page).toHaveURL(`${origin}${path}`);
        await expect(page.locator('[data-screen]')).toHaveAttribute('data-screen-status', 'mounted');
        expect(await reactRoots()).toBe(1);
        await page.goBack();
        await expect(page).toHaveURL(`${origin}/`);
        await expect(page.locator('[data-screen]')).toHaveCount(0);
        expect(await reactRoots()).toBe(1);
    }
    expect(await page.evaluate(() => window.__smokeSameDocument)).toBe(true);
};

const keepLatestDraftList = async () => {
    await open('/write');
    let requests = 0;
    const { promise: firstStarted, resolve: markFirstStarted } = Promise.withResolvers();
    const { promise: firstReleased, resolve: releaseFirst } = Promise.withResolvers();
    const draftsUrl = '**/v1/drafts';
    await page.route(draftsUrl, async (route) => {
        const first = ++requests === 1;
        if (first) {
            markFirstStarted();
            await firstReleased;
        }
        await route.fulfill({
            json: {
                status: 'DONE',
                body: {
                    drafts: [
                        {
                            url: first ? 'older-draft' : 'newer-draft',
                            title: first ? 'Older draft response' : 'Latest draft response',
                            createdDate: new Date().toISOString()
                        }
                    ]
                }
            }
        });
    });
    try {
        const openDrafts = page.getByRole('button', { name: '임시 포스트', exact: true });
        await openDrafts.click();
        await firstStarted;
        await page.getByRole('dialog', { name: '임시 포스트' }).getByRole('button', { name: '닫기' }).click();
        await openDrafts.click();
        await expect(page.getByText('Latest draft response')).toBeVisible();
        const olderResponse = page.waitForResponse((response) => response.url().endsWith('/v1/drafts'));
        releaseFirst();
        await (await olderResponse).finished();
        await page.evaluate(
            () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
        );
        await expect(page.getByText('Latest draft response')).toBeVisible();
        await expect(page.getByText('Older draft response')).toHaveCount(0);
        await page.getByRole('dialog', { name: '임시 포스트' }).getByRole('button', { name: '닫기' }).click();
    } finally {
        releaseFirst();
        await page.unroute(draftsUrl);
    }
};

const selectPinnedPostWithKeyboard = async () => {
    const pinnableUrl = '**/v1/setting/pinnable-posts*';
    await page.route(pinnableUrl, (route) =>
        route.fulfill({
            json: {
                status: 'DONE',
                body: {
                    posts: ['First', 'Second'].map((title) => ({
                        url: title.toLowerCase(),
                        title,
                        image: null,
                        createdDate: '2026-01-01'
                    })),
                    page: 1,
                    limit: 30,
                    lastPage: 1,
                    totalCount: 2,
                    hasNext: false,
                    hasPrevious: false
                }
            }
        })
    );
    try {
        await open('/settings/pinned-posts');
        await page.getByRole('button', { name: '포스트 고정하기', exact: true }).click();
        const dialog = page.getByRole('dialog');
        const first = dialog.getByRole('radio', { name: '고정할 포스트 선택: First', exact: true });
        const second = dialog.getByRole('radio', { name: '고정할 포스트 선택: Second', exact: true });
        const pin = dialog.getByRole('button', { name: '포스트 고정', exact: true });
        await expect(pin).toBeDisabled();
        await first.focus();
        await first.press('Space');
        await expect(first).toBeChecked();
        await first.press('ArrowDown');
        await expect(second).toBeFocused();
        await expect(second).toBeChecked();
        await expect(first).not.toBeChecked();
        await expect(pin).toBeEnabled();
        await second.press('ArrowUp');
        await expect(first).toBeChecked();
        await dialog.getByRole('searchbox').fill('Second');
        await expect(first).not.toBeChecked();
        await expect(second).not.toBeChecked();
        await expect(pin).toBeDisabled();
        await dialog.getByRole('button', { name: '취소', exact: true }).click();
    } finally {
        await page.unroute(pinnableUrl);
    }
};

const useSettingsListWithKeyboard = async () => {
    // The series are created before the list first loads. A suspense query keeps a list cached under a second
    // ago, so reloading right after it loaded would show it without them.
    await open('/');
    const csrf = (await page.context().cookies()).find((cookie) => cookie.name === 'csrftoken')?.value;
    expect(csrf).toBeTruthy();
    const created = [];
    for (const name of ['Keyboard series A', 'Keyboard series B']) {
        const response = await page.request.post(`${origin}/v1/series`, {
            headers: { origin, 'x-csrftoken': csrf },
            data: { name, url: name.toLowerCase().replaceAll(' ', '-') }
        });
        expect(response.ok()).toBe(true);
        const result = await response.json();
        expect(result.status).toBe('DONE');
        created.push(result.body);
    }
    await open('/settings/series');
    const first = page.getByRole('button', { name: 'Keyboard series A 0개의 포스트', exact: true });
    await expect(page.getByRole('heading', { name: 'Keyboard series A', exact: true })).toBeVisible();
    await first.focus();
    await page.keyboard.down('Space');
    await expect(page).toHaveURL(`${origin}/settings/series`);
    await page.keyboard.up('Space');
    await expect(page).toHaveURL(`${origin}/@${account.username}/series/${created[0].url}`);

    await page.setViewportSize({ width: 375, height: 812 });
    await open('/settings/series');
    const handle = page.getByRole('button', { name: 'Keyboard series A 시리즈 순서 변경', exact: true });
    await handle.focus();
    await handle.press('Space');
    await expect(handle).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('[aria-live="assertive"]')).toContainText(`droppable area ${created[0].id}.`);
    // The keyboard sensor installs its key listener in a later task after announcing the drag.
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await handle.press('ArrowUp');
    await expect(page.locator('[aria-live="assertive"]')).toContainText(`droppable area ${created[1].id}.`);
    const reordered = page.waitForResponse(
        (response) => new URL(response.url()).pathname === '/v1/series/order' && response.request().method() === 'PUT'
    );
    await handle.press('Space');
    expect((await (await reordered).json()).status).toBe('DONE');
    const order = await (await page.request.get(`${origin}/v1/setting/series`)).json();
    expect(order.body.series.map((series) => series.id)).toEqual([created[0].id, created[1].id]);
    await expect(page).toHaveURL(`${origin}/settings/series`);

    await page.getByRole('button', { name: 'Keyboard series A 시리즈 메뉴 열기', exact: true }).click();
    await page.getByRole('menuitem', { name: '시리즈 편집', exact: true }).click();
    await expect(page).toHaveURL(`${origin}/settings/series/edit/${created[0].id}`);
    await expect(page.getByRole('textbox').first()).toHaveValue('Keyboard series A');
    await page.setViewportSize({ width: 1280, height: 900 });
};

const keepTagFocusWithUserAction = async () => {
    await open('/write');
    const add = page.getByRole('button', { name: '태그 추가', exact: true });
    const input = page.getByRole('textbox', { name: '새 태그 이름', exact: true });
    await add.click();
    await expect(input).toBeFocused();
    await input.fill('kept-tag');
    await input.press('Enter');
    await expect(input).toBeFocused();
    await expect(input).toHaveValue('');
    await input.fill('discarded-tag');
    await input.press('Escape');
    await expect(input).toHaveCount(0);
    await expect(add).toBeFocused();
    await add.press('Space');
    await expect(input).toBeFocused();
    await expect(input).toHaveValue('');
    const title = page.getByPlaceholder('제목을 입력하세요');
    await title.click();
    await expect(input).toHaveCount(0);
    await expect(title).toBeFocused();
    await page.getByRole('button', { name: /kept-tag.*태그/ }).click();
};

const keepSearchFocusWithUserAction = async () => {
    await page.setViewportSize({ width: 375, height: 812 });
    await open('/search');
    const screen = page.locator('[data-screen="SearchPage"]');
    const input = screen.getByRole('textbox', { name: '포스트 검색', exact: true });
    await expect(screen).toHaveAttribute('data-screen-status', 'mounted');
    await expect(input).not.toBeFocused();
    await input.fill('focus-check');
    await input.press('Enter');
    await expect(page).toHaveURL(`${origin}/search?q=focus-check`);
    await expect(screen.getByRole('heading', { name: '검색 결과가 없습니다', exact: true })).toBeVisible();
    await screen.getByRole('button', { name: '검색어 초기화', exact: true }).click();
    await expect(input).toHaveValue('');
    await expect(input).toBeFocused();
    await screen.getByRole('button', { name: 'focus-check', exact: true }).focus();
    await page.goBack();
    await expect(input).toHaveValue('focus-check');
    await expect(input).not.toBeFocused();
    await page.goForward();
    await expect(input).toHaveValue('');
    await expect(input).not.toBeFocused();
    await page.setViewportSize({ width: 1280, height: 900 });
};

const keepNoticeFocusWhenCarouselStarts = async () => {
    await open('/');
    const csrf = (await page.context().cookies()).find((cookie) => cookie.name === 'csrftoken')?.value;
    expect(csrf).toBeTruthy();
    const headers = { origin, 'x-csrftoken': csrf };
    const notices = [];
    const chunk = '**/assets/ui/assets/discovery-page-*.js';
    const { promise: released, resolve: release } = Promise.withResolvers();
    let continued;
    try {
        for (const title of ['First smoke notice', 'Second smoke notice']) {
            const response = await page.request.post(`${origin}/v1/global-notices`, {
                headers,
                data: { title, url: '/tags' }
            });
            const result = await response.json();
            expect(result.status).toBe('DONE');
            notices.push(result.body.id);
        }
        await page.route(chunk, (route) => {
            continued = released.then(() => route.continue());
            return continued;
        });
        await page.goto(`${origin}/`, { waitUntil: 'commit' });
        const second = page.locator('[data-notice-slide]').nth(1);
        await second.focus();
        release();
        await expect(page.locator('[data-notice-controls]')).toBeVisible();
        await expect(second).toBeVisible();
        await expect(second).toBeFocused();
    } finally {
        release();
        await continued;
        await page.unroute(chunk);
        for (const id of notices) await page.request.delete(`${origin}/v1/global-notices/${id}`, { headers });
    }
};

const keepThemePreferenceAcrossPages = async () => {
    await page.emulateMedia({ colorScheme: 'light' });
    await open('/');
    const root = page.locator('html');
    const toggle = page.locator('[data-site-theme-toggle]:visible').first();
    await expect(root).toHaveAttribute('data-theme', 'light');
    await toggle.click();
    await expect(root).toHaveAttribute('data-theme', 'dark');
    const cookie = (await page.context().cookies()).find((entry) => entry.name === 'blex_theme');
    expect(cookie).toMatchObject({ value: 'dark', path: '/', sameSite: 'Lax', secure: false });
    expect(Math.abs(cookie.expires - Date.now() / 1000 - 31_536_000)).toBeLessThan(60);
    await open('/settings/profile');
    await expect(root).toHaveAttribute('data-theme', 'dark');
    await page.reload({ waitUntil: 'networkidle' });
    await expect(root).toHaveAttribute('data-theme', 'dark');
    await toggle.click();
    await expect(root).toHaveAttribute('data-theme', 'light');
    await open('/');
    await expect(root).toHaveAttribute('data-theme', 'light');
    await page.reload({ waitUntil: 'networkidle' });
    await expect(root).toHaveAttribute('data-theme', 'light');
    await page.context().clearCookies({ name: 'blex_theme' });
    await page.emulateMedia({ colorScheme: 'dark' });
    await expect(root).toHaveAttribute('data-theme', 'dark');
    await expect(root).toHaveAttribute('data-theme-preference', 'system');
    await page.emulateMedia({ colorScheme: 'light' });
    await expect(root).toHaveAttribute('data-theme', 'light');
    await page.emulateMedia({ colorScheme: null });
};

const returnToFragmentPositions = async () => {
    await open('/docs/developer-api/quickstart');
    const top = (id) => page.locator(`#${id}`).evaluate((section) => Math.round(section.getBoundingClientRect().top));
    const follow = async (id) => {
        // A scripted click leaves the page where the previous fragment put it.
        await page
            .locator(`a[href="#${id}"]`)
            .first()
            .evaluate((link) => link.click());
        await expect(page).toHaveURL(new RegExp(`#${id}$`));
        await expect.poll(() => top(id)).toBeLessThan(200);
    };
    await follow('connect');
    const connectTop = await top('connect');
    await follow('draft');
    await page.goBack();
    await expect(page).toHaveURL(/#connect$/);
    await expect.poll(() => top('connect')).toBe(connectTop);
    await page.goBack();
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
    await page.goForward();
    await expect.poll(() => top('connect')).toBe(connectTop);
};

const translateCodeCopyButton = async () => {
    await open('/');
    const csrf = (await page.context().cookies()).find((cookie) => cookie.name === 'csrftoken')?.value;
    expect(csrf).toBeTruthy();
    const created = await (
        await page.request.post(`${origin}/v1/posts`, {
            headers: { origin, 'x-csrftoken': csrf },
            data: {
                title: 'Code copy labels',
                url: `code-copy-labels-${Date.now()}`,
                contentHtml: '<pre><code class="language-javascript">const copied = true;</code></pre>'
            }
        })
    ).json();
    expect(created.status).toBe('DONE');
    const catalog = /\/messages[-.][^/]*\.js/;
    const { promise: released, resolve: release } = Promise.withResolvers();
    await page.route(catalog, async (route) => {
        const response = await route.fetch();
        // The header's text module can share the file name, so only a module exporting a catalog waits.
        if (/\bas messages\}/.test(await response.text())) await released;
        return route.fulfill({ response });
    });
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write'], { origin });
    try {
        const postCode = page.waitForResponse((response) => /\/post-page-[^/]*\.js$/.test(response.url()));
        await page.goto(`${origin}/@${account.username}/${created.body.url}`, { waitUntil: 'commit' });
        await postCode;
        await page.evaluate(
            () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
        );
        // The labels are translated, so the button waits for the page's catalog even when the page code is ready.
        const button = page.locator('.code-copy-button');
        await expect(button).toHaveCount(0);
        release();
        await expect(button).toHaveAttribute('aria-label', '코드 복사');
        await expect(button).toHaveAttribute('title', '코드 복사');
        await button.click();
        await expect(button).toHaveAttribute('title', '복사 완료!');
        await expect(button).toHaveAttribute('aria-label', '코드 복사');
    } finally {
        release();
        await page.unroute(catalog);
        await page.context().clearPermissions();
    }
};

const keepMediaControlFocus = async () => {
    await open('/write');
    const editor = page.locator('.ProseMirror');
    await editor.click();
    await page.locator('input[type=file][multiple][accept*="image/"]').setInputFiles({
        name: 'focus-test.png',
        mimeType: 'image/png',
        buffer: Buffer.from(
            'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAHElEQVQokWNoIBEwjGogAjAQowgZjGogBtA+lAAlhIAQFdpNuQAAAABJRU5ErkJggg==',
            'base64'
        )
    });
    await expect(editor.locator('img')).toBeVisible();
    const media = editor.getByRole('button', { name: '미디어 설정' });
    await media.focus();
    await media.press('Enter');
    await page.getByRole('button', { name: '미디어 설정' }).last().click();
    const alignLeft = page.getByRole('button', { name: '왼쪽 정렬' });
    await alignLeft.focus();
    await alignLeft.press('Enter');
    await expect(alignLeft).toBeFocused();

    await page.getByRole('button', { name: '게시 설정', exact: true }).click();
    const settings = page.getByRole('dialog', { name: '게시 설정' });
    await settings
        .locator('label')
        .filter({ hasText: /^시리즈$/ })
        .click();
    await expect(page.getByRole('listbox')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('listbox')).toHaveCount(0);
    await settings.getByRole('button', { name: '닫기' }).click();
};

const keepRejectedPublishInEditor = async () => {
    const body = 'This body must survive a rejected publish.';
    await open('/write');
    await page.getByPlaceholder('제목을 입력하세요').fill('Rejected publish');
    await page.locator('.ProseMirror').click();
    await page.keyboard.type(body);
    await page.locator('input[name=image]').setInputFiles({
        name: 'broken.png',
        mimeType: 'image/png',
        buffer: Buffer.from('not an image')
    });
    await page.locator('[data-tour=post-publish]').click();
    await page.getByRole('button', { name: '확인 후 발행' }).click();
    await expect(page.getByText('이미지 업로드에 실패했습니다.').first()).toBeVisible();
    await expect(page).toHaveURL(/\/write(?:\?|$)/);
    await expect(page.getByPlaceholder('제목을 입력하세요')).toHaveValue('Rejected publish');
    await expect(page.locator('.ProseMirror')).toContainText(body);
};

try {
    for (const [name, step] of [
        ['first admin, typed before the setup form hydrates', createFirstAdmin],
        ['account menu and logout', logOutFromAccountMenu],
        ['login', logIn],
        ['a failed translation file recovers with one reload', recoverFromFailedCatalog],
        ['mobile menu', openMobileMenu],
        ['site menus and the theme answer before the header or the page hydrates', useSiteControlsBeforeHydration],
        [
            'a post whose code fails to load keeps the typed comment, its open menu, and the login prompt',
            keepPostMarkupWhenItsCodeFails
        ],
        [
            'theme preference persists across public and settings pages and follows the system when cleared',
            keepThemePreferenceAcrossPages
        ],
        ['invalid screen data fails safely without interpreting names as HTML', rejectInvalidScreenData],
        ['a screen render error leaves the application working', isolateScreenRenderError],
        ['screens render in the application root and leave nothing behind', renderScreensInApplicationRoot],
        ['back and forward return to each fragment the reader followed', returnToFragmentPositions],
        ['the code block copy button speaks the page language once its translations load', translateCodeCopyButton],
        ['pinned post selection supports arrow keys and resets after a search', selectPinnedPostWithKeyboard],
        ['settings list separates native activation, keyboard reordering, and menus', useSettingsListWithKeyboard],
        ['tag input returns focus on Escape without stealing focus after blur', keepTagFocusWithUserAction],
        [
            'search focuses on explicit clearing and preserves history without grabbing focus',
            keepSearchFocusWithUserAction
        ],
        ['a notice focused before the home page hydrates stays shown and focused', keepNoticeFocusWhenCarouselStarts],
        ['editor', openEditor],
        ['the editor opens in the application and warns before unsaved edits leave it', warnBeforeLeavingEditor],
        ['a toast whose code fails to load leaves typed and unsaved work in place', keepUnsavedWorkWhenToastCodeFails],
        ['a toaster that throws leaves the page and the application working', isolateToasterRenderError],
        ['latest draft list survives an older response', keepLatestDraftList],
        ['media keyboard controls keep focus and settings labels activate their controls', keepMediaControlFocus],
        ...editorPublishingChecks({ page, open, username: account.username }),
        ['rejected publish keeps the post', keepRejectedPublishInEditor]
    ]) {
        await step();
        console.log(`ok: ${name}`);
    }
    if (failures.length > 0) throw new Error(failures.join('\n'));
    console.log('Browser smoke test passed.');
} catch (error) {
    console.error(`Browser smoke test failed at ${page.url()}`);
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
} finally {
    await browser.close();
}
