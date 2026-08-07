import { expect, test, type Page } from '@playwright/test';

const locales = [
    {
        browserLocale: 'en-US',
        commentsTitle: 'Comments',
        emptyState: 'No comments yet',
        loginAction: 'Log in to comment',
        promptTitle: 'Login required',
        promptDescription: 'Log in to leave a comment.'
    },
    {
        browserLocale: 'ko-KR',
        commentsTitle: '댓글',
        emptyState: '아직 댓글이 없습니다',
        loginAction: '로그인하고 댓글 작성',
        promptTitle: '로그인이 필요해요',
        promptDescription: '댓글을 남기려면 로그인해 주세요.'
    }
] as const;

const collectRuntimeErrors = (page: Page) => {
    const errors: string[] = [];

    page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
    page.on('console', (message) => {
        if (message.type() === 'error') {
            errors.push(`console.error: ${message.text()}`);
        }
    });

    return errors;
};

for (const locale of locales) {
    test.describe(`localized post interactions (${locale.browserLocale})`, () => {
        test.use({ locale: locale.browserLocale });

        test('keeps the logged-out comment action keyboard accessible', async ({ page }) => {
            const runtimeErrors = collectRuntimeErrors(page);

            await page.route('**/v1/posts/post-detail-i18n/comments', async (route) => {
                await route.fulfill({
                    contentType: 'application/json',
                    body: JSON.stringify({
                        status: 'DONE',
                        body: {
                            canComment: true,
                            comments: []
                        }
                    })
                });
            });

            await page.goto('/login');
            await expect(page.locator('island-component[name="Login"]'))
                .toHaveAttribute('data-island-status', 'mounted');

            await page.evaluate(() => {
                const comments = document.createElement('island-component');
                comments.setAttribute('name', 'Comments');
                comments.setAttribute('props', encodeURIComponent(JSON.stringify({
                    postUrl: 'post-detail-i18n'
                })));
                document.body.appendChild(comments);
            });

            const comments = page.locator('island-component[name="Comments"]');
            await expect(comments).toHaveAttribute('data-island-status', 'mounted');
            await expect(comments.getByRole('heading', {
                name: locale.commentsTitle,
                exact: true
            })).toBeVisible();
            await expect(comments.getByText(locale.emptyState, { exact: true })).toBeVisible();

            const loginAction = comments.getByRole('button', {
                name: locale.loginAction,
                exact: true
            });
            await loginAction.focus();
            await expect(loginAction).toBeFocused();
            await loginAction.press('Enter');

            const dialog = page.getByRole('dialog', {
                name: locale.promptTitle,
                exact: true
            });
            await expect(dialog).toBeVisible();
            await expect(dialog.getByText(locale.promptDescription, { exact: true }))
                .toBeVisible();

            expect(runtimeErrors, runtimeErrors.join('\n')).toEqual([]);
        });
    });
}
