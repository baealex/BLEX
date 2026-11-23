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

const openMobileMenu = async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await open('/');
    await page.locator('[data-site-menu-open]').click();
    const menu = page.locator('#blex-mobile-menu');
    await expect(menu).toHaveJSProperty('open', true);
    await expect(menu.getByRole('link', { name: '설정' })).toBeVisible();
    await page.setViewportSize({ width: 1280, height: 900 });
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
        ['mobile menu', openMobileMenu],
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
