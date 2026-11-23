import assert from 'node:assert/strict';
import { expect } from '@playwright/test';

const image = {
    name: 'writing-journey.png',
    mimeType: 'image/png',
    buffer: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAHElEQVQokWNoIBEwjGogAjAQowgZjGogBtA+lAAlhIAQFdpNuQAAAABJRU5ErkJggg==',
        'base64'
    )
};

export function editorPublishingChecks({ page, open, username }) {
    const title = `Writing journey ${Date.now()}`;
    const subtitle = '저장한 부제도 그대로 유지되어야 합니다.';
    const body = '임시 저장부터 발행까지 이 본문과 이미지가 보존되어야 합니다. 😀';
    const editedTitle = `${title} updated`;
    const addedText = '새로고침 후 복구한 수정 내용도 저장되어야 합니다.';
    const paragraphs = [body];
    const editor = page.locator('.ProseMirror');
    let postPath;
    let imageSrc;
    let coverSrc;

    const assertEditorContent = async (expectedTitle, edited = false) => {
        await expect(page.getByPlaceholder('제목을 입력하세요')).toHaveValue(expectedTitle);
        await expect(page.locator('input[name=subtitle]')).toHaveValue(subtitle);
        for (const paragraph of paragraphs) await expect(editor).toContainText(paragraph);
        if (edited) await expect(editor).toContainText(addedText);
        await expect(editor.locator('img')).toHaveAttribute('src', imageSrc);
    };

    const assertPublishedContent = async (expectedTitle, edited = false) => {
        await expect(page.getByRole('heading', { name: expectedTitle, exact: true })).toBeVisible();
        const content = page.locator('.blog-post-content');
        for (const paragraph of paragraphs) await expect(content).toContainText(paragraph);
        if (edited) await expect(content).toContainText(addedText);
        await expect(content.locator('img')).toHaveAttribute('src', imageSrc);
        await expect.poll(() => content.locator('img').evaluate((element) => element.naturalWidth)).toBeGreaterThan(0);
        const cover = page.locator('img[itemprop=image]');
        await expect(cover).toBeVisible();
        coverSrc ??= await cover.getAttribute('src');
        assert.ok(coverSrc);
        await expect(cover).toHaveAttribute('src', coverSrc);
        await expect.poll(() => cover.evaluate((element) => element.naturalWidth)).toBeGreaterThan(0);
    };

    const saveAndReloadDraft = async () => {
        await page.setViewportSize({ width: 375, height: 812 });
        await open('/write');
        await page.getByPlaceholder('제목을 입력하세요').fill(title);
        await page.locator('input[name=subtitle]').fill(subtitle);
        await editor.click();
        await page.keyboard.insertText(body);
        await page.keyboard.press('Enter');
        await page.locator('input[type=file][multiple][accept*="image/"]').setInputFiles(image);
        await expect(editor.locator('img')).toBeVisible();
        imageSrc = await editor.locator('img').getAttribute('src');
        assert.ok(imageSrc);
        await page.locator('input[name=image]').setInputFiles(image);

        const save = page.getByRole('button', { name: '임시 저장', exact: true });
        await expect(save).toBeEnabled();
        const response = page.waitForResponse(
            (result) =>
                /^\/v1\/drafts(?:\/[^/]+)?$/.test(new URL(result.url()).pathname) &&
                ['POST', 'PUT'].includes(result.request().method())
        );
        await save.click();
        const saved = await (await response).json();
        assert.equal(saved.status, 'DONE');
        await expect(page.getByText('임시 저장되었습니다.', { exact: true })).toBeVisible();
        await expect(page).toHaveURL((url) => url.searchParams.get('draft') === saved.body.url);
        postPath = `/@${encodeURIComponent(username)}/${encodeURIComponent(saved.body.url)}`;

        await page.reload({ waitUntil: 'networkidle' });
        await assertEditorContent(title);
    };

    const saveWhileTyping = async () => {
        const autosavedText = '자동 저장으로 남겨야 하는 문장입니다.';
        const latestText = '앞선 저장을 기다리는 동안 추가한 내용도 남아야 합니다.';
        const draftPath = `/v1/drafts/${new URL(page.url()).searchParams.get('draft')}`;
        const draftRequest = (url) => url.pathname === draftPath;
        const { promise: released, resolve: release } = Promise.withResolvers();
        let waiting = false;
        await page.route(draftRequest, async (route) => {
            if (!waiting && route.request().method() === 'PUT') {
                waiting = true;
                await released;
            }
            await route.continue();
        });
        try {
            await editor.press('ControlOrMeta+End');
            await page.keyboard.press('Enter');
            await page.keyboard.insertText(autosavedText);
            await expect.poll(() => waiting, { timeout: 10000 }).toBe(true);
            await page.keyboard.press('Enter');
            await page.keyboard.insertText(latestText);
            const saved = page.waitForResponse(
                (response) =>
                    new URL(response.url()).pathname === draftPath &&
                    response.request().method() === 'PUT' &&
                    response.request().postData()?.includes(latestText),
                { timeout: 15000 }
            );
            release();
            assert.equal((await (await saved).json()).status, 'DONE');
            paragraphs.push(autosavedText, latestText);
            await page.reload({ waitUntil: 'networkidle' });
            await assertEditorContent(title);
        } finally {
            release();
            await page.unroute(draftRequest);
        }
    };

    const publishSavedDraft = async () => {
        await page.locator('[data-tour=post-publish]').click();
        await page.getByRole('button', { name: '확인 후 발행', exact: true }).click();
        await page.waitForURL((url) => url.pathname === postPath);
        await assertPublishedContent(title);

        await open('/settings/posts');
        await expect(page.getByRole('link', { name: new RegExp(title) })).toBeVisible();
    };

    const recoverAndUpdatePost = async () => {
        await page.setViewportSize({ width: 1280, height: 900 });
        await open(`${postPath}/edit`);
        await assertEditorContent(title);
        await page.getByPlaceholder('제목을 입력하세요').fill(editedTitle);
        await editor.press('ControlOrMeta+End');
        await page.keyboard.press('Enter');
        await page.keyboard.insertText(addedText);
        await page.reload({ waitUntil: 'networkidle' });

        const recovery = page.locator('[data-post-edit-recovery]');
        await expect(recovery).toBeVisible();
        await expect(page.getByPlaceholder('제목을 입력하세요')).toHaveValue(title);
        const original = await page.request.get(new URL(postPath, page.url()).href);
        assert.ok(original.ok());
        assert.ok(!(await original.text()).includes(addedText), 'Unsaved edits changed the published post');
        await recovery.getByRole('button', { name: '복구', exact: true }).click();
        await assertEditorContent(editedTitle, true);
        await page.locator('[data-tour=post-publish]').click();
        await page.waitForURL((url) => url.pathname === postPath);
        await assertPublishedContent(editedTitle, true);

        await open(`${postPath}/edit`);
        await assertEditorContent(editedTitle, true);
        await expect(recovery).toHaveCount(0);
    };

    const trashAndRestorePost = async () => {
        await page.setViewportSize({ width: 375, height: 812 });
        await open('/settings/posts');
        await page.getByRole('button', { name: `${editedTitle} 포스트 메뉴 열기`, exact: true }).click();
        await page.getByRole('menuitem', { name: '휴지통으로 이동', exact: true }).click();
        await page.getByRole('dialog').getByRole('button', { name: '휴지통으로 이동', exact: true }).click();
        await expect(page.getByRole('link', { name: new RegExp(editedTitle) })).toHaveCount(0);
        const trashed = await page.request.get(new URL(postPath, page.url()).href);
        assert.equal(trashed.status(), 404);

        await open('/settings/posts?tab=trash');
        await page.getByRole('button', { name: `${editedTitle} 휴지통 메뉴 열기`, exact: true }).click();
        await page.getByRole('menuitem', { name: '복원', exact: true }).click();
        await page
            .getByRole('dialog', { name: '포스트 복원' })
            .getByRole('button', { name: '복원', exact: true })
            .click();
        await expect(page.getByRole('heading', { name: editedTitle, exact: true })).toHaveCount(0);
        await open('/settings/posts');
        await expect(page.getByRole('link', { name: new RegExp(editedTitle) })).toBeVisible();
        await open(postPath);
        await assertPublishedContent(editedTitle, true);
        for (const source of [imageSrc, coverSrc]) {
            const response = await page.request.get(new URL(source, page.url()).href);
            expect(response.ok()).toBe(true);
            expect(response.headers()['content-type']).toMatch(/^image\//);
        }
        await open(`${postPath}/edit`);
        await assertEditorContent(editedTitle, true);
    };

    return [
        ['draft content and images survive a reload', saveAndReloadDraft],
        ['autosave preserves edits typed while an earlier save is pending', saveWhileTyping],
        ['a saved draft publishes with its content and images', publishSavedDraft],
        ['unsaved edits recover after a reload and persist after updating', recoverAndUpdatePost],
        ['trashing and restoring keeps the post content and images', trashAndRestorePost]
    ];
}
