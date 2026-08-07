import { expect, test, type Page } from '@playwright/test';

const locales = [
    {
        browserLocale: 'en-US',
        heading: 'New post',
        titleLabel: 'Title',
        contentLabel: 'Content',
        editorTips: '✨ Editor tips',
        publishAction: 'Publish',
        checklistTitle: 'Complete the required fields',
        readyChecklistTitle: 'Final review before publishing',
        checklistConfirm: 'Review and publish',
        cancelAction: 'Cancel',
        savedStatus: 'Saved just now',
        settingsAction: 'Post settings',
        seriesLabel: 'Series',
        imageRatioLabel: 'Image ratio',
        scheduleAction: 'Select a publish time',
        scheduledHour: 'Scheduled hour',
        quickSchedule: 'In 3 hours',
        doneAction: 'Done',
        previewAction: 'Preview post',
        previewTitle: 'Post preview',
        closePreviewAction: 'Close preview'
    },
    {
        browserLocale: 'ko-KR',
        heading: '새 포스트',
        titleLabel: '제목',
        contentLabel: '본문',
        editorTips: '✨ 에디터 사용법',
        publishAction: '발행',
        checklistTitle: '발행 전에 꼭 채워주세요',
        readyChecklistTitle: '발행 전 최종 확인',
        checklistConfirm: '확인 후 발행',
        cancelAction: '취소',
        savedStatus: '방금 저장됨',
        settingsAction: '게시 설정',
        seriesLabel: '시리즈',
        imageRatioLabel: '이미지 비율',
        scheduleAction: '예약 시간 선택',
        scheduledHour: '예약 시',
        quickSchedule: '3시간 후',
        doneAction: '완료',
        previewAction: '포스트 미리보기',
        previewTitle: '포스트 미리보기',
        closePreviewAction: '미리보기 닫기'
    }
] as const;

const mountNewPostEditor = async (page: Page) => {
    await page.route('**/v1/setting/series', async (route) => {
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
                status: 'DONE',
                body: { series: [] }
            })
        });
    });

    await page.goto('/login');
    await expect(page.locator('island-component[name="Login"]'))
        .toHaveAttribute('data-island-status', 'mounted');

    await page.evaluate(() => {
        const editor = document.createElement('island-component');
        editor.setAttribute('name', 'PostEditor');
        editor.setAttribute('props', encodeURIComponent(JSON.stringify({
            mode: 'new',
            username: 'writer'
        })));
        document.body.appendChild(editor);
    });

    const editor = page.locator('island-component[name="PostEditor"]');
    await expect(editor).toHaveAttribute('data-island-status', 'mounted');
    return editor;
};

for (const locale of locales) {
    test.describe(`localized post editor (${locale.browserLocale})`, () => {
        test.use({ locale: locale.browserLocale });

        test('labels publishing requirements and autosaves the first change', async ({ page }) => {
            const draftTitle = `First autosave ${locale.browserLocale}`;

            await page.route('**/v1/drafts', async (route) => {
                if (route.request().method() !== 'POST') {
                    await route.fallback();
                    return;
                }

                await route.fulfill({
                    contentType: 'application/json',
                    body: JSON.stringify({
                        status: 'DONE',
                        body: { url: 'first-autosave' }
                    })
                });
            });
            await page.route('**/v1/drafts/first-autosave', async (route) => {
                await route.fulfill({
                    contentType: 'application/json',
                    body: JSON.stringify({
                        status: 'DONE',
                        body: { url: 'first-autosave' }
                    })
                });
            });
            await page.route('**/write/preview/first-autosave', async (route) => {
                await route.fulfill({
                    contentType: 'text/html',
                    body: '<!doctype html><html><body><main>Saved preview</main></body></html>'
                });
            });

            const editor = await mountNewPostEditor(page);
            await expect(editor.getByRole('heading', {
                level: 1,
                name: locale.heading,
                exact: true
            })).toBeAttached();
            await expect(editor.getByRole('textbox', {
                name: locale.contentLabel,
                exact: true
            })).toBeVisible();
            const editorTips = editor.getByRole('button', {
                name: locale.editorTips,
                exact: true
            });
            await expect(editorTips).toHaveAttribute('aria-expanded', 'false');
            await editorTips.click();
            await expect(editorTips).toHaveAttribute('aria-expanded', 'true');

            await editor.getByRole('button', {
                name: locale.publishAction,
                exact: true
            }).click();

            const checklist = page.getByRole('dialog', {
                name: locale.checklistTitle,
                exact: true
            });
            await expect(checklist).toBeVisible();
            await expect(checklist.getByRole('button', {
                name: locale.checklistConfirm,
                exact: true
            })).toBeDisabled();
            await checklist.getByRole('button', {
                name: locale.cancelAction,
                exact: true
            }).click();

            const draftRequest = page.waitForRequest((request) => (
                request.method() === 'POST'
                && new URL(request.url()).pathname === '/v1/drafts'
            ), { timeout: 5_000 });
            await editor.getByRole('textbox', {
                name: locale.titleLabel,
                exact: true
            }).fill(draftTitle);
            const request = await draftRequest;

            expect(request.postDataJSON()).toMatchObject({ title: draftTitle });
            await expect(editor.getByText(locale.savedStatus, { exact: true })).toBeVisible();

            await editor.getByRole('button', {
                name: locale.settingsAction,
                exact: true
            }).click();
            const settings = page.getByRole('dialog', {
                name: locale.settingsAction,
                exact: true
            });
            await expect(settings.getByRole('combobox', {
                name: locale.seriesLabel,
                exact: true
            })).toBeVisible();
            await expect(settings.getByRole('combobox', {
                name: locale.imageRatioLabel,
                exact: true
            })).toBeVisible();
            await settings.getByRole('button', {
                name: locale.scheduleAction,
                exact: true
            }).click();
            await expect(page.getByRole('spinbutton', {
                name: locale.scheduledHour,
                exact: true
            })).toBeVisible();
            await expect(page.getByRole('button', {
                name: locale.quickSchedule,
                exact: true
            })).toBeVisible();
            await page.keyboard.press('Escape');
            await settings.getByRole('button', {
                name: locale.doneAction,
                exact: true
            }).click();

            await editor.getByRole('button', {
                name: locale.previewAction,
                exact: true
            }).click();
            const preview = page.getByRole('dialog', {
                name: locale.previewTitle,
                exact: true
            });
            await expect(preview).toBeVisible();
            await expect(preview.locator('iframe')).toBeVisible();
            await preview.getByRole('button', {
                name: locale.closePreviewAction,
                exact: true
            }).click();

            await editor.getByRole('textbox', {
                name: locale.contentLabel,
                exact: true
            }).fill('A saved post body');
            await editor.getByRole('button', {
                name: locale.publishAction,
                exact: true
            }).click();
            const readyChecklist = page.getByRole('dialog', {
                name: locale.readyChecklistTitle,
                exact: true
            });
            await expect(readyChecklist).toBeVisible();
            await expect(readyChecklist.getByRole('button', {
                name: locale.checklistConfirm,
                exact: true
            })).toBeEnabled();
        });
    });
}
