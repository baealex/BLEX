import { expect, test, type Page } from '@playwright/test';

test.use({ locale: 'ko-KR' });

const collectRuntimeSignals = (page: Page) => {
    const errors: string[] = [];

    page.on('pageerror', (error) => {
        errors.push(`pageerror: ${error.message}`);
    });

    page.on('console', (message) => {
        if (message.type() === 'error') {
            errors.push(`console.error: ${message.text()}`);
        }
    });

    return errors;
};

test('Django and the search island switch locale as one page', async ({ page, context }) => {
    const errors = collectRuntimeSignals(page);
    const query = 'React 리액트';
    const userTitle = 'My 리액트 Post';

    await page.route('**/resources/assets/images/ghost.jpg', async (route) => {
        await route.fulfill({
            contentType: 'image/svg+xml',
            body: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" />'
        });
    });

    await page.route('**/v1/search?**', async (route) => {
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
                status: 'DONE',
                body: {
                    elapsedTime: 0.001,
                    totalSize: 1,
                    lastPage: 1,
                    query,
                    results: [
                        {
                            url: 'mixed-language-post',
                            title: userTitle,
                            image: 'None',
                            description: 'User-written description',
                            readTime: 3,
                            createdDate: '2026년 01월 02일',
                            publishedDate: '2026-01-02',
                            authorImage: '',
                            author: 'writer',
                            positions: ['제목'],
                            matchedFields: ['title']
                        }
                    ]
                }
            })
        });
    });

    await page.goto(`/search?q=${encodeURIComponent(query)}`);

    const island = page.locator('island-component[name="SearchPage"]');
    await expect(island).toHaveAttribute('data-island-status', 'mounted');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ko');
    expect(await page.evaluate(() => window.configuration.locale)).toBe('ko');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('포스트 검색');
    await expect(page.getByText('1개의 포스트')).toBeVisible();
    await expect(page.getByRole('heading', { name: userTitle })).toBeVisible();
    await expect(page.getByText('제목', { exact: true })).toBeVisible();
    await expect(page.getByRole('img', { name: 'writer' })).toHaveAttribute(
        'src',
        '/resources/assets/images/ghost.jpg'
    );
    await expect(page).toHaveTitle(new RegExp(`검색: ${query}`));

    const csrfToken = await page.evaluate(() => {
        const cookie = document.cookie
            .split(';')
            .map((item) => item.trim())
            .find((item) => item.startsWith('csrftoken='));

        return cookie ? decodeURIComponent(cookie.slice('csrftoken='.length)) : '';
    });
    expect(csrfToken).not.toBe('');

    const languageResponse = await context.request.post('/i18n/setlang/', {
        form: {
            language: 'en',
            next: `/search?q=${encodeURIComponent(query)}`
        },
        headers: {
            'X-CSRFToken': csrfToken,
            Referer: page.url()
        },
        maxRedirects: 0
    });
    expect(languageResponse.status()).toBe(302);

    await page.reload();

    await expect(island).toHaveAttribute('data-island-status', 'mounted');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    expect(await page.evaluate(() => window.configuration.locale)).toBe('en');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Search posts');
    await expect(page.getByText('1 post', { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: userTitle })).toBeVisible();
    await expect(page.getByText('Title', { exact: true })).toBeVisible();
    await expect(page.getByText('Jan 2, 2026', { exact: true })).toBeVisible();
    await expect(page).toHaveTitle(new RegExp(`Search: ${query}`));

    expect(errors, errors.join('\n')).toEqual([]);
});
