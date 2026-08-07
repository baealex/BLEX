import { expect, test, type Page } from '@playwright/test';

const locales = [
    {
        browserLocale: 'en-US',
        postStatus: 'Post status',
        postTabs: ['Published', 'Scheduled', 'Drafts', 'Trash'],
        postsLoading: 'Loading posts...',
        notificationSettings: 'Settings',
        notificationDialog: 'Notification settings',
        notificationLoading: 'Loading notification settings...',
        notificationEmpty: 'No notification options are available.',
        username: 'Username',
        updateUsername: 'Update username',
        name: 'Name',
        updateName: 'Update name',
        nameUpdated: 'Name updated.'
    },
    {
        browserLocale: 'ko-KR',
        postStatus: '포스트 상태',
        postTabs: ['발행 포스트', '예약 포스트', '임시 포스트', '휴지통'],
        postsLoading: '포스트 불러오는 중...',
        notificationSettings: '설정',
        notificationDialog: '알림 설정',
        notificationLoading: '알림 설정 불러오는 중...',
        notificationEmpty: '알림 설정 항목이 없습니다.',
        username: '사용자 필명',
        updateUsername: '필명 업데이트',
        name: '이름',
        updateName: '이름 업데이트',
        nameUpdated: '이름을 업데이트했습니다.'
    }
] as const;

const mountSettingsApp = async (page: Page, route: string) => {
    await page.goto('/login');
    await expect(page.locator('island-component[name="Login"]'))
        .toHaveAttribute('data-island-status', 'mounted');

    await page.evaluate((settingsRoute) => {
        window.history.replaceState({}, '', settingsRoute);

        const settings = document.createElement('island-component');
        settings.setAttribute('name', 'SettingsApp');
        settings.setAttribute('props', encodeURIComponent(JSON.stringify({
            isEditor: true,
            isStaff: true,
            isSuperuser: true,
            settingsMode: 'user',
            basePath: '/settings'
        })));
        document.body.appendChild(settings);
    }, route);

    const settings = page.locator('island-component[name="SettingsApp"]');
    await expect(settings).toHaveAttribute('data-island-status', 'mounted');
    return settings;
};

for (const locale of locales) {
    test.describe(`localized settings feedback (${locale.browserLocale})`, () => {
        test.use({
            locale: locale.browserLocale,
            viewport: { width: 375, height: 812 }
        });

        test('keeps all post tabs visible and shows explicit loading feedback', async ({ page }) => {
            let releasePosts: () => void = () => undefined;
            let markPostsRequested: () => void = () => undefined;
            const postsGate = new Promise<void>((resolve) => {
                releasePosts = resolve;
            });
            const postsRequested = new Promise<void>((resolve) => {
                markPostsRequested = resolve;
            });

            await page.route('**/v1/setting/tag', async (route) => {
                await route.fulfill({
                    contentType: 'application/json',
                    body: JSON.stringify({ status: 'DONE', body: { tags: [] } })
                });
            });
            await page.route('**/v1/setting/series', async (route) => {
                await route.fulfill({
                    contentType: 'application/json',
                    body: JSON.stringify({ status: 'DONE', body: { series: [] } })
                });
            });
            await page.route('**/v1/setting/posts**', async (route) => {
                markPostsRequested();
                await postsGate;
                await route.fulfill({
                    contentType: 'application/json',
                    body: JSON.stringify({
                        status: 'DONE',
                        body: {
                            posts: [],
                            username: 'writer',
                            lastPage: 1,
                            totalCount: 0
                        }
                    })
                });
            });

            const settings = await mountSettingsApp(page, '/settings/posts');
            await postsRequested;

            const loading = settings.getByRole('status', {
                name: locale.postsLoading,
                exact: true
            });
            await expect(loading).toBeVisible();
            await expect(loading).toContainText(locale.postsLoading);
            await expect(settings.locator('.animate-pulse')).toHaveCount(0);

            const tabs = settings.getByRole('tablist', {
                name: locale.postStatus,
                exact: true
            });
            await expect(tabs).toBeVisible();
            for (const tabName of locale.postTabs) {
                await expect(tabs.getByRole('tab', {
                    name: tabName,
                    exact: true
                })).toBeVisible();
            }
            expect(await tabs.evaluate((element) => (
                element.scrollWidth <= element.clientWidth
            ))).toBe(true);
            expect(await page.evaluate(() => (
                document.documentElement.scrollWidth <= document.documentElement.clientWidth
            ))).toBe(true);

            releasePosts();
            await expect(loading).toBeHidden();
        });

        test('enables account updates after the first field change', async ({ page }) => {
            let accountName = 'Alex Kim';
            let submittedName = '';

            await page.route('**/v1/setting/account', async (route) => {
                const method = route.request().method();
                if (method === 'GET') {
                    await route.fulfill({
                        contentType: 'application/json',
                        body: JSON.stringify({
                            status: 'DONE',
                            body: {
                                username: 'writer',
                                name: accountName,
                                email: 'writer@example.com',
                                createdDate: '2026-08-07',
                                accountDeletionRedirectUrl: '',
                                has2fa: false
                            }
                        })
                    });
                    return;
                }

                if (method === 'PUT') {
                    const formData = new URLSearchParams(route.request().postData() ?? '');
                    submittedName = formData.get('name') ?? '';
                    if (submittedName) accountName = submittedName;
                    await route.fulfill({
                        contentType: 'application/json',
                        body: JSON.stringify({
                            status: 'DONE',
                            body: { success: true }
                        })
                    });
                    return;
                }

                await route.fallback();
            });

            const settings = await mountSettingsApp(page, '/settings/account');
            const usernameInput = settings.getByRole('textbox', {
                name: locale.username,
                exact: true
            });
            const updateUsername = settings.getByRole('button', {
                name: locale.updateUsername,
                exact: true
            });
            await expect(usernameInput).toHaveValue('writer');
            await usernameInput.fill('audit-writer');
            await expect(updateUsername).toBeEnabled();
            await usernameInput.fill('writer');
            await expect(updateUsername).toBeDisabled();

            const nameInput = settings.getByRole('textbox', {
                name: locale.name,
                exact: true
            });
            const updateName = settings.getByRole('button', {
                name: locale.updateName,
                exact: true
            });
            await expect(nameInput).toHaveValue(accountName);
            await nameInput.fill('Bilingual Writer');
            await expect(updateName).toBeEnabled();
            await updateName.click();

            await expect.poll(() => submittedName).toBe('Bilingual Writer');
            await expect(page.getByText(locale.nameUpdated, { exact: true })).toBeVisible();
        });

        test('keeps the notification dialog responsive while its options load', async ({ page }) => {
            let releaseConfig: () => void = () => undefined;
            let markConfigRequested: () => void = () => undefined;
            const configGate = new Promise<void>((resolve) => {
                releaseConfig = resolve;
            });
            const configRequested = new Promise<void>((resolve) => {
                markConfigRequested = resolve;
            });

            await page.route('**/v1/setting/notify', async (route) => {
                await route.fulfill({
                    contentType: 'application/json',
                    body: JSON.stringify({
                        status: 'DONE',
                        body: { notify: [], isTelegramSync: false }
                    })
                });
            });
            await page.route('**/v1/setting/notify-config', async (route) => {
                markConfigRequested();
                await configGate;
                await route.fulfill({
                    contentType: 'application/json',
                    body: JSON.stringify({
                        status: 'DONE',
                        body: { config: [] }
                    })
                });
            });

            const settings = await mountSettingsApp(page, '/settings/notify');
            await settings.getByRole('button', {
                name: locale.notificationSettings,
                exact: true
            }).click();
            await configRequested;

            const dialog = page.getByRole('dialog', {
                name: locale.notificationDialog,
                exact: true
            });
            const loading = dialog.getByRole('status', {
                name: locale.notificationLoading,
                exact: true
            });
            await expect(loading).toBeVisible();
            await expect(loading).toContainText(locale.notificationLoading);
            await expect(dialog.locator('.animate-pulse')).toHaveCount(0);

            releaseConfig();
            await expect(dialog.getByText(locale.notificationEmpty, { exact: true })).toBeVisible();
        });
    });
}
