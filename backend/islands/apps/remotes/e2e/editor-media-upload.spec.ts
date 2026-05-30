import { expect, test, type Locator, type Page } from '@playwright/test';

const uploadedImageUrl = 'data:image/png;base64,R0lGODlhAQABAAAAACw=';
const uploadedVideoUrl = 'data:video/mp4;base64,AAAA';

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

const expectNoRuntimeErrors = (errors: string[]) => {
    expect(errors, errors.join('\n')).toEqual([]);
};

const mountPostEditor = async (page: Page) => {
    await page.route('**/v1/setting/series', async (route) => {
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
                status: 'DONE',
                body: { series: [] }
            })
        });
    });

    await page.goto('/');
    await page.waitForFunction(() => Boolean(customElements.get('island-component')));
    await page.evaluate(() => {
        const island = document.createElement('island-component');
        island.setAttribute('name', 'PostEditor');
        island.setAttribute('props', encodeURIComponent(JSON.stringify({
            mode: 'new',
            username: 'smoke-admin'
        })));
        document.body.appendChild(island);
    });

    await expect(page.locator('island-component[name="PostEditor"]')).toHaveAttribute('data-island-status', 'mounted');
    await expect(page.locator('.ProseMirror')).toBeVisible();
};

const getVisibleDropPoint = async (locator: Locator) => {
    await locator.scrollIntoViewIfNeeded();

    const box = await locator.boundingBox();
    if (!box) {
        throw new Error('Could not find a visible element for drop point');
    }

    return {
        x: box.x + box.width / 2,
        y: box.y + Math.min(box.height / 2, 24)
    };
};

const dispatchFileDrop = async (
    page: Page,
    point: { x: number; y: number },
    file: { name: string; type: string; body?: string }
) => {
    await page.evaluate(({ point, file }) => {
        const target = document.elementFromPoint(point.x, point.y);
        if (!target) {
            throw new Error('No element at drop point');
        }

        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(new File(
            [file.body ?? 'blex media upload e2e'],
            file.name,
            { type: file.type }
        ));

        for (const eventName of ['dragenter', 'dragover', 'drop']) {
            target.dispatchEvent(new DragEvent(eventName, {
                bubbles: true,
                cancelable: true,
                clientX: point.x,
                clientY: point.y,
                dataTransfer
            }));
        }
    }, { point, file });
};

const dispatchHtmlDrop = async (
    page: Page,
    point: { x: number; y: number },
    html: string
) => {
    await page.evaluate(({ point, html }) => {
        const target = document.elementFromPoint(point.x, point.y);
        if (!target) {
            throw new Error('No element at drop point');
        }

        const dataTransfer = new DataTransfer();
        dataTransfer.setData('text/html', html);

        for (const eventName of ['dragenter', 'dragover', 'drop']) {
            target.dispatchEvent(new DragEvent(eventName, {
                bubbles: true,
                cancelable: true,
                clientX: point.x,
                clientY: point.y,
                dataTransfer
            }));
        }
    }, { point, html });
};

test.describe('PostEditor media drag and drop', () => {
    test('drops an image at the visual drop position instead of the stale cursor', async ({ page }) => {
        const errors = collectRuntimeSignals(page);
        let finishUpload: (() => void) | null = null;
        const uploadCanFinish = new Promise<void>((resolve) => {
            finishUpload = resolve;
        });

        await page.route('**/v1/image', async (route) => {
            await uploadCanFinish;
            await route.fulfill({
                contentType: 'application/json',
                body: JSON.stringify({
                    status: 'DONE',
                    body: { url: uploadedImageUrl }
                })
            });
        });

        await mountPostEditor(page);

        const editor = page.locator('.ProseMirror');
        await editor.click();
        await page.keyboard.type('Alpha');
        await page.keyboard.press('Enter');
        await page.keyboard.type('Beta');
        await page.keyboard.press('Enter');

        const paragraphs = editor.locator('p');
        await expect(paragraphs.nth(0)).toHaveText('Alpha');
        await expect(paragraphs.nth(1)).toHaveText('Beta');

        await paragraphs.nth(0).click();
        const dropPoint = await getVisibleDropPoint(paragraphs.nth(2));

        await dispatchFileDrop(page, dropPoint, {
            name: 'drop.png',
            type: 'image/png'
        });

        await expect(editor.locator('.media-upload-placeholder')).toContainText('이미지 업로드 중');
        await expect(page.locator('[role="status"]')).toContainText('파일 업로드 중');

        finishUpload?.();

        await expect(editor.locator('figure img[src^="data:image/png"]')).toBeVisible();
        await expect(editor.locator('.media-upload-placeholder')).toHaveCount(0);

        const html = await page.locator('input[name="content_html"]').inputValue();
        expect(html).toContain(uploadedImageUrl);
        expect(html).not.toContain('media-upload-placeholder');
        expect(html.indexOf('Alpha')).toBeLessThan(html.indexOf('Beta'));
        expect(html.indexOf('Beta')).toBeLessThan(html.indexOf(uploadedImageUrl));
        expectNoRuntimeErrors(errors);
    });

    test('accepts dropped video files and inserts a video node', async ({ page }) => {
        const errors = collectRuntimeSignals(page);

        await page.route('**/v1/image', async (route) => {
            await route.fulfill({
                contentType: 'application/json',
                body: JSON.stringify({
                    status: 'DONE',
                    body: { url: uploadedVideoUrl }
                })
            });
        });

        await mountPostEditor(page);

        const editor = page.locator('.ProseMirror');
        const dropPoint = await getVisibleDropPoint(editor);

        await dispatchFileDrop(page, dropPoint, {
            name: 'clip.mp4',
            type: 'video/mp4'
        });

        await expect(editor.locator('figure video source[src^="data:video/mp4"]')).toHaveCount(1);

        const html = await page.locator('input[name="content_html"]').inputValue();
        expect(html).toContain(uploadedVideoUrl);
        expect(html).not.toContain('media-upload-placeholder');
        expectNoRuntimeErrors(errors);
    });

    test('blocks dragged remote media html instead of silently copying it into the document', async ({ page }) => {
        const errors = collectRuntimeSignals(page);
        await mountPostEditor(page);

        const editor = page.locator('.ProseMirror');
        const dropPoint = await getVisibleDropPoint(editor);

        await dispatchHtmlDrop(
            page,
            dropPoint,
            '<img src="https://example.com/remote-image.png" alt="Remote">'
        );

        await expect(page.locator('text=이미지나 비디오는 파일로 내려놓아 주세요.')).toBeVisible();
        await expect(editor.locator('figure')).toHaveCount(0);

        const html = await page.locator('input[name="content_html"]').inputValue();
        expect(html).not.toContain('remote-image.png');
        expectNoRuntimeErrors(errors);
    });
});
