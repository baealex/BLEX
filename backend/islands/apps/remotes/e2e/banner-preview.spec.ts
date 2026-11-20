import { expect, test, type Page } from '@playwright/test';

const mountBannerEditor = async (page: Page) => {
    await page.route('**/v1/banners/templates', (route) => route.fulfill({
        json: {
            status: 'DONE',
            body: {
                templates: [{
                    template: 'card',
                    bannerTypes: ['horizontal', 'sidebar'],
                    sample: {
                        eyebrow: '',
                        headline: '시작 문구',
                        description: '',
                        linkLabel: '',
                        linkUrl: ''
                    },
                    html: '<div class="blex-banner">시작 문구</div>'
                }]
            }
        }
    }));
    await page.route('**/v1/banners/preview', (route) => {
        const { headline, position } = route.request().postDataJSON() as { headline: string; position: string };
        const text = headline.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
        return route.fulfill({
            json: {
                status: 'DONE',
                body: { html: `<div class="blex-banner" data-preview-slot="${position}">${text}</div>` }
            }
        });
    });

    await page.goto('/');
    await page.evaluate(() => {
        history.pushState(null, '', '/settings/banners/create');
        const settings = document.createElement('island-component');
        settings.setAttribute('name', 'SettingsApp');
        settings.setAttribute('props', encodeURIComponent(JSON.stringify({
            isEditor: true,
            isStaff: false
        })));
        document.body.replaceChildren(settings);
    });
    await page.getByRole('button', {
        name: '카드 배너',
        exact: true
    }).click();
};

test('keeps the live draft visible and places the latest version in the post', async ({ page }) => {
    await mountBannerEditor(page);
    const live = page.getByRole('region', { name: '배너 미리보기' });
    const headline = page.getByLabel('제목', { exact: true });
    await expect(live.getByText('시작 문구', { exact: true })).toBeVisible();
    await headline.fill('편집 중인 배너');
    await expect(live.getByText('편집 중인 배너', { exact: true })).toBeVisible();
    await page.getByRole('button', {
        name: '상단',
        exact: true
    }).click();
    await headline.fill('글에 들어갈 배너');
    await page.getByRole('button', { name: '글에서 미리보기' }).click();

    const preview = page.getByRole('dialog', { name: '글 미리보기' });
    const article = preview.getByRole('article');
    await expect(article.getByRole('heading', { name: '예시 글' })).toBeVisible();
    await expect(article.getByText('글에 들어갈 배너', { exact: true })).toBeVisible();
    expect(await article.evaluate((element) => {
        const banner = element.querySelector('[data-preview-slot="top"]');
        const body = element.querySelector('[itemprop="articleBody"]');
        return banner && body && Boolean(banner.compareDocumentPosition(body) & Node.DOCUMENT_POSITION_FOLLOWING);
    })).toBe(true);
});

test('browser Back and the mobile preview action return to the current draft', async ({ page }) => {
    await page.setViewportSize({
        width: 375,
        height: 812
    });
    await page.emulateMedia({ colorScheme: 'dark' });
    await mountBannerEditor(page);
    const headline = page.getByLabel('제목', { exact: true });
    const button = page.getByRole('button', { name: '글에서 미리보기' });
    const dialog = page.getByRole('dialog', { name: '글 미리보기' });
    await headline.fill('아직 저장하지 않은 배너');
    // Scroll only after the live preview has settled, so its height cannot move the page afterwards.
    await expect(page.getByRole('region', { name: '배너 미리보기' }).getByText('아직 저장하지 않은 배너', { exact: true })).toBeVisible();
    // The site scrolls smoothly, so jump instantly and read the position once it has landed.
    await page.evaluate(() => window.scrollTo({
        top: 300,
        behavior: 'instant'
    }));
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(300);
    const editorScroll = await page.evaluate(() => window.scrollY);
    await button.click();
    await expect(dialog).toBeVisible();
    await expect(page).toHaveURL(/step=preview/);

    await page.goBack();
    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL(/\/settings\/banners\/create\?template=card$/);
    await expect(headline).toHaveValue('아직 저장하지 않은 배너');
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(editorScroll);
    await expect(page.getByRole('region', { name: '배너 미리보기' })).toBeInViewport();

    await page.goForward();
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: '편집으로 돌아가기' }).click();
    await expect(dialog).toBeHidden();
    await expect(headline).toHaveValue('아직 저장하지 않은 배너');
    await expect(button).toBeFocused();
});
