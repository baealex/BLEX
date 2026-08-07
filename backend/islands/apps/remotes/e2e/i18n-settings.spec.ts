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
        nameUpdated: 'Name updated.',
        createSeries: 'Create series',
        seriesEditorTitle: 'Create series',
        reorderSeries: 'Change order of series: Building in Public',
        openSeriesMenu: 'Open menu for series: Building in Public',
        bannerHtml: 'Banner HTML',
        upload: 'Upload',
        uploading: 'Uploading...',
        brandAssetSaved: 'Brand asset saved.',
        inviteDeleteDialog: 'Delete invitation link',
        inviteDeleted: 'Invitation link deleted.',
        delete: 'Delete',
        roleSelect: 'Change role for reader',
        readerRole: 'Reader',
        authorRole: 'Author',
        roleDialog: 'Change role',
        change: 'Change',
        roleChanged: "Changed reader's role to Author."
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
        nameUpdated: '이름을 업데이트했습니다.',
        createSeries: '새 시리즈 생성',
        seriesEditorTitle: '시리즈 생성',
        reorderSeries: 'Building in Public 시리즈 순서 변경',
        openSeriesMenu: 'Building in Public 시리즈 메뉴 열기',
        bannerHtml: '배너 HTML',
        upload: '업로드',
        uploading: '업로드 중...',
        brandAssetSaved: '브랜드 자산이 저장되었습니다.',
        inviteDeleteDialog: '초대 링크 삭제',
        inviteDeleted: '초대 링크를 삭제했습니다.',
        delete: '삭제',
        roleSelect: 'reader 역할 변경',
        readerRole: '독자',
        authorRole: '작가',
        roleDialog: '권한 변경',
        change: '변경',
        roleChanged: 'reader님의 권한을 작가로 변경했습니다.'
    }
] as const;

const mountSettingsApp = async (
    page: Page,
    route: string,
    settingsMode: 'user' | 'admin' = 'user'
) => {
    await page.goto('/login');
    await expect(page.locator('island-component[name="Login"]'))
        .toHaveAttribute('data-island-status', 'mounted');

    await page.evaluate(({ route: settingsRoute, settingsMode: mode }) => {
        window.history.replaceState({}, '', settingsRoute);

        const settings = document.createElement('island-component');
        settings.setAttribute('name', 'SettingsApp');
        settings.setAttribute('props', encodeURIComponent(JSON.stringify({
            isEditor: true,
            isStaff: true,
            isSuperuser: true,
            settingsMode: mode,
            basePath: mode === 'admin' ? '/admin-settings' : '/settings',
            adminCapabilities: {
                canManageSiteSettings: true,
                canManageLoginSettings: true,
                canManageIntegrationSettings: true,
                canManageUtilities: true
            }
        })));
        document.body.appendChild(settings);
    }, { route, settingsMode });

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

        test('keeps series list actions and post selection semantically separate', async ({ page }) => {
            await page.route('**/v1/setting/series', async (route) => {
                await route.fulfill({
                    contentType: 'application/json',
                    body: JSON.stringify({
                        status: 'DONE',
                        body: {
                            username: 'writer',
                            series: [{
                                id: 7,
                                url: 'building-in-public',
                                title: 'Building in Public',
                                totalPosts: 2
                            }]
                        }
                    })
                });
            });
            await page.route('**/v1/series/valid-posts', async (route) => {
                await route.fulfill({
                    contentType: 'application/json',
                    body: JSON.stringify({
                        status: 'DONE',
                        body: [{
                            id: 11,
                            title: 'First audit post',
                            publishedDate: '2026-08-01'
                        }]
                    })
                });
            });
            await page.route('**/v1/setting/account', async (route) => {
                await route.fulfill({
                    contentType: 'application/json',
                    body: JSON.stringify({
                        status: 'DONE',
                        body: {
                            username: 'writer',
                            name: 'Writer',
                            email: 'writer@example.com',
                            createdDate: '2026-08-07',
                            accountDeletionRedirectUrl: '',
                            has2fa: false
                        }
                    })
                });
            });

            const settings = await mountSettingsApp(page, '/settings/series');
            const seriesHeading = settings.getByRole('heading', {
                name: 'Building in Public',
                exact: true
            });
            const contentAction = seriesHeading.locator('xpath=ancestor::*[@role="button"][1]');
            await expect(contentAction).toBeVisible();
            await expect(contentAction.getByRole('button')).toHaveCount(0);
            await expect(settings.getByRole('button', {
                name: locale.reorderSeries,
                exact: true
            })).toBeVisible();
            await expect(settings.getByRole('button', {
                name: locale.openSeriesMenu,
                exact: true
            })).toBeVisible();

            const createSeries = settings.getByRole('button', {
                name: locale.createSeries,
                exact: true
            });
            await createSeries.focus();
            await createSeries.press('Enter');
            await expect(page).toHaveURL(/\/settings\/series\/create$/);
            await expect(settings.getByRole('heading', {
                name: locale.seriesEditorTitle,
                exact: true
            })).toBeVisible();

            const postCheckbox = settings.getByRole('checkbox', {
                name: /First audit post/
            });
            await expect(postCheckbox).toBeVisible();
            await expect(settings.getByRole('button', {
                name: /First audit post/
            })).toHaveCount(0);
            await postCheckbox.click();
            await expect(postCheckbox).toBeChecked();
        });

        test('shows configuration code fields immediately as native text areas', async ({ page }) => {
            const settings = await mountSettingsApp(page, '/settings/banners/create');
            const editor = settings.getByRole('textbox', {
                name: locale.bannerHtml,
                exact: true
            });

            await expect(editor).toBeVisible();
            expect(await editor.evaluate(element => element.tagName)).toBe('TEXTAREA');
            await expect(editor).toHaveAttribute('data-language', 'html');
            await expect(settings.getByRole('status')).toHaveCount(0);

            await editor.fill('<div>Localized banner</div>');
            await expect(editor).toHaveValue('<div>Localized banner</div>');
        });

        test('keeps brand file uploads visibly in progress at the selected action', async ({ page }) => {
            let releaseUpload: () => void = () => undefined;
            let markUploadRequested: () => void = () => undefined;
            const uploadGate = new Promise<void>((resolve) => {
                releaseUpload = resolve;
            });
            const uploadRequested = new Promise<void>((resolve) => {
                markUploadRequested = resolve;
            });
            const siteSetting = {
                siteName: 'Northstar Notes',
                siteDescription: '',
                logoSvgUrl: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>',
                logoSvgDarkUrl: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>',
                iconSvgUrl: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>',
                iconSvgDarkUrl: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>',
                faviconUrl: '',
                iconPngUrls: {},
                hasCustomLogo: false,
                hasCustomLogoDark: false,
                hasCustomIcon: false,
                hasCustomIconDark: false,
                headerScript: '',
                footerScript: '',
                canManageScripts: true,
                seoEnabled: true,
                robotsTxtExtraRules: '',
                robotsTxtDefault: '',
                aeoEnabled: true,
                updatedDate: '2026-08-07T00:00:00Z'
            };

            await page.route('**/v1/site-settings**', async (route) => {
                const request = route.request();
                const path = new URL(request.url()).pathname;

                if (path.endsWith('/brand-assets') && request.method() === 'POST') {
                    markUploadRequested();
                    await uploadGate;
                    await route.fulfill({
                        contentType: 'application/json',
                        body: JSON.stringify({ status: 'DONE', body: siteSetting })
                    });
                    return;
                }

                if (path.endsWith('/site-settings') && request.method() === 'GET') {
                    await route.fulfill({
                        contentType: 'application/json',
                        body: JSON.stringify({ status: 'DONE', body: siteSetting })
                    });
                    return;
                }

                await route.fallback();
            });

            const settings = await mountSettingsApp(
                page,
                '/admin-settings/site-settings',
                'admin'
            );
            const fileInput = settings.locator('input[type="file"]').first();
            const uploadButton = fileInput.locator('xpath=following-sibling::button[1]');
            await expect(uploadButton).toBeVisible();
            await expect(uploadButton).toHaveAccessibleName(locale.upload);

            await fileInput.setInputFiles({
                name: 'northstar.svg',
                mimeType: 'image/svg+xml',
                buffer: Buffer.from(
                    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 40"><rect width="120" height="40" fill="#111827"/></svg>'
                )
            });
            await uploadRequested;

            await expect(uploadButton).toHaveAccessibleName(locale.uploading);
            await expect(uploadButton).toHaveAttribute('aria-busy', 'true');
            await expect(uploadButton).toBeDisabled();

            releaseUpload();
            await expect(page.getByText(locale.brandAssetSaved, { exact: true })).toBeVisible();
            await expect(uploadButton).toHaveAccessibleName(locale.upload);
            await expect(uploadButton).not.toHaveAttribute('aria-busy', 'true');
        });

        test('removes closed confirmation and select portals immediately', async ({ page }) => {
            await page.setViewportSize({ width: 1024, height: 768 });

            let role = 'READER';
            let invites = [{
                id: 7,
                code: 'BILINGUAL-AUDIT',
                note: '',
                signupUrl: '/signup?invite=BILINGUAL-AUDIT',
                isActive: true,
                isClaimed: false,
                createdBy: 'admin',
                claimedBy: '',
                createdDate: '2026-08-07T00:00:00Z',
                claimedDate: null
            }];
            const managedUser = () => ({
                id: 2,
                username: 'reader',
                name: 'Reader',
                email: 'reader@example.com',
                role,
                isActive: true,
                isStaff: false,
                isSuperuser: false,
                canChangeRole: true,
                postCount: 0,
                dateJoined: '2026-08-01T00:00:00Z',
                lastLogin: null
            });

            await page.route('**/v1/admin/users**', async (route) => {
                if (route.request().method() === 'PATCH') {
                    role = String(route.request().postDataJSON().role);
                    await route.fulfill({
                        contentType: 'application/json',
                        body: JSON.stringify({
                            status: 'DONE',
                            body: { user: managedUser() }
                        })
                    });
                    return;
                }

                await route.fulfill({
                    contentType: 'application/json',
                    body: JSON.stringify({
                        status: 'DONE',
                        body: {
                            users: [managedUser()],
                            pagination: {
                                page: 1,
                                pageSize: 20,
                                total: 1,
                                totalPages: 1,
                                hasNext: false,
                                hasPrevious: false
                            },
                            stats: {
                                total: 1,
                                editors: role === 'EDITOR' ? 1 : 0,
                                readers: role === 'READER' ? 1 : 0,
                                admins: 0
                            }
                        }
                    })
                });
            });
            await page.route('**/v1/admin/author-invites**', async (route) => {
                if (route.request().method() === 'DELETE') {
                    invites = [];
                    await route.fulfill({
                        contentType: 'application/json',
                        body: JSON.stringify({
                            status: 'DONE',
                            body: { success: true }
                        })
                    });
                    return;
                }

                await route.fulfill({
                    contentType: 'application/json',
                    body: JSON.stringify({
                        status: 'DONE',
                        body: { invites }
                    })
                });
            });

            const settings = await mountSettingsApp(
                page,
                '/admin-settings/users',
                'admin'
            );
            const inviteCode = settings.getByText('BILINGUAL-AUDIT', { exact: true });
            const inviteRow = inviteCode.locator(
                'xpath=ancestor::div[contains(@class, "flex flex-col gap-3 px-4 py-4")][1]'
            );
            await inviteRow.getByRole('button', {
                name: locale.delete,
                exact: true
            }).click();
            const inviteDialog = page.getByRole('dialog', {
                name: locale.inviteDeleteDialog,
                exact: true
            });
            await inviteDialog.getByRole('button', {
                name: locale.delete,
                exact: true
            }).click();
            await expect(page.getByText(locale.inviteDeleted, { exact: true })).toBeVisible();
            await expect(inviteDialog).toBeHidden();
            await expect(page.locator('[role="dialog"][data-state="closed"]')).toHaveCount(0);

            const roleSelect = settings.getByRole('combobox', {
                name: locale.roleSelect,
                exact: true
            });
            await expect(roleSelect).toContainText(locale.readerRole);
            await roleSelect.click();
            await page.getByRole('option', {
                name: locale.authorRole,
                exact: true
            }).click();
            await expect(page.getByRole('listbox')).toBeHidden();
            await expect(page.locator('[role="listbox"][data-state="closed"]')).toHaveCount(0);

            const roleDialog = page.getByRole('dialog', {
                name: locale.roleDialog,
                exact: true
            });
            await roleDialog.getByRole('button', {
                name: locale.change,
                exact: true
            }).click();
            await expect(page.getByText(locale.roleChanged, { exact: true })).toBeVisible();
            await expect(roleDialog).toBeHidden();
            await expect(roleSelect).toContainText(locale.authorRole);
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
