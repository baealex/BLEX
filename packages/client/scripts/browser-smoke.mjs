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
    await open(`/setup?token=${encodeURIComponent(setupToken)}`);
    await page.locator('input[name=username]').fill(account.username);
    await page.locator('input[name=displayName]').fill(account.displayName);
    await page.locator('input[name=email]').fill(account.email);
    await page.locator('input[name=password]').fill(account.password);
    await page.locator('input[name=passwordCheck]').fill(account.password);
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
    await page.route(catalog, (route) => (documents === 1 ? route.abort() : route.continue()));
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

const rejectInvalidScreenData = async () => {
    await open('/settings/profile');
    const settings = page.locator('[data-screen="SettingsApp"]:not([data-smoke-invalid-screen])');
    await expect(settings).toHaveAttribute('data-screen-status', 'mounted');
    const cases = [
        { id: 'malformed-screen', name: '<img data-bootstrap-injection="">', encodedProps: '%' },
        {
            id: 'invalid-settings-screen',
            name: 'SettingsApp',
            encodedProps: encodeURIComponent(JSON.stringify({ isEditor: false, isStaff: 'false' }))
        },
        { id: 'unknown-screen', name: 'MissingScreen', encodedProps: encodeURIComponent('{}') }
    ];
    try {
        await page.evaluate((cases) => {
            for (const { id, name, encodedProps } of cases) {
                const element = document.createElement('div');
                element.id = id;
                element.dataset.smokeInvalidScreen = '';
                element.dataset.screen = name;
                element.dataset.screenStatus = 'pending';
                element.dataset.screenProps = encodedProps;
                document.body.append(element);
            }
        }, cases);
        for (const { id, name } of cases) {
            const screen = page.locator(`#${id}`);
            await expect(screen).toHaveAttribute('data-screen-status', 'error');
            await expect(screen).toHaveAttribute('data-screen-error', 'bootstrap_error');
            await expect(screen).toHaveText(`Component Error: ${name}`);
            await expect(screen.locator('img')).toHaveCount(0);
        }
        await expect(settings).toHaveAttribute('data-screen-status', 'mounted');
    } finally {
        await page.evaluate(() => {
            for (const element of document.querySelectorAll('[data-smoke-invalid-screen]')) element.remove();
        });
    }
};

const isolateScreenRenderError = async () => {
    await open('/settings/profile');
    const settings = page.locator('[data-screen="SettingsApp"]');
    await expect(settings).toHaveAttribute('data-screen-status', 'mounted');
    const toasterChunk = '**/assets/web/chunks/toaster.*.js';
    await page.route(toasterChunk, (route) =>
        route.fulfill({
            contentType: 'text/javascript',
            body: 'export default function BrokenScreen() { throw new Error("smoke-screen-render-error"); }'
        })
    );
    try {
        await page.evaluate(() => {
            const element = document.createElement('div');
            element.id = 'broken-screen';
            element.dataset.screen = 'Toaster';
            element.dataset.screenStatus = 'pending';
            document.body.append(element);
        });
        const brokenScreen = page.locator('#broken-screen');
        await expect(brokenScreen).toHaveAttribute('data-screen-status', 'error');
        await expect(brokenScreen).toHaveAttribute('data-screen-error', 'render_error');
        await expect(brokenScreen).toHaveText('Component Error: Toaster');
        await expect(settings).toHaveAttribute('data-screen-status', 'mounted');
    } finally {
        await page.evaluate(() => document.querySelector('#broken-screen')?.remove());
        await page.unroute(toasterChunk);
    }
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
    await open('/settings/series');
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
    await page.reload({ waitUntil: 'networkidle' });
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
        ['first admin', createFirstAdmin],
        ['account menu and logout', logOutFromAccountMenu],
        ['login', logIn],
        ['a failed translation file recovers with one reload', recoverFromFailedCatalog],
        ['mobile menu', openMobileMenu],
        ['site menus and the theme answer before the header or the page hydrates', useSiteControlsBeforeHydration],
        [
            'theme preference persists across public and settings pages and follows the system when cleared',
            keepThemePreferenceAcrossPages
        ],
        ['invalid screen data fails safely without interpreting names as HTML', rejectInvalidScreenData],
        ['a screen render error leaves other screens mounted', isolateScreenRenderError],
        ['pinned post selection supports arrow keys and resets after a search', selectPinnedPostWithKeyboard],
        ['settings list separates native activation, keyboard reordering, and menus', useSettingsListWithKeyboard],
        ['tag input returns focus on Escape without stealing focus after blur', keepTagFocusWithUserAction],
        [
            'search focuses on explicit clearing and preserves history without grabbing focus',
            keepSearchFocusWithUserAction
        ],
        ['editor', openEditor],
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
