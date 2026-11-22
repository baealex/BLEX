import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';

test.use({
    locale: 'en-US',
    timezoneId: 'America/Los_Angeles',
    viewport: { width: 375, height: 812 },
    colorScheme: 'dark'
});

test('uses browser preferences at signup and applies account changes', async ({ page }) => {
    const username = `locale${randomUUID().slice(0, 8)}`;
    await page.goto('/sign?next=/settings/account');
    await page.getByLabel('Username', { exact: true }).fill(username);
    await page.getByLabel('Display name').fill('Locale Reader');
    await page.getByLabel('Email').fill(`${username}@example.test`);
    await page.getByLabel('Password', { exact: true }).fill('Stargazing!9271');
    await page.getByLabel('Confirm password').fill('Stargazing!9271');
    await page.getByRole('button', { name: 'Sign up as a reader' }).click();

    await expect(page).toHaveURL('/settings/account');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    const language = page.getByRole('combobox', { name: 'Language', exact: true });
    const timeZone = page.getByRole('combobox', { name: 'Time zone', exact: true });
    await expect(language).toHaveValue('en');
    await expect(timeZone).toHaveValue('America/Los_Angeles');

    const preferences = page.locator('form').filter({ has: timeZone });
    await language.selectOption('ko');
    await timeZone.selectOption('Asia/Seoul');
    const save = preferences.getByRole('button', { name: 'Save', exact: true });
    await expect(save).toBeEnabled();
    await save.press('Enter');

    await expect(page.locator('html')).toHaveAttribute('lang', 'ko');
    await expect(page.getByRole('combobox', { name: '언어', exact: true })).toHaveValue('ko');
    await expect(page.getByRole('combobox', { name: '시간대', exact: true })).toHaveValue('Asia/Seoul');
});
