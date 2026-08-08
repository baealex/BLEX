import { expect, test } from '@playwright/test';

const locales = [
    {
        browserLocale: 'en-US',
        loginAction: 'Log in',
        signupAction: 'Sign up as a reader',
        required: {
            username: 'Username is required.',
            displayName: 'Display name is required.',
            email: 'Email is required.',
            password: 'Password is required.',
            confirmPassword: 'Confirm your password.'
        },
        invalid: {
            username: 'Use only lowercase letters and numbers.',
            email: 'Enter a valid email address.',
            password: 'Password must be at least 8 characters.'
        }
    },
    {
        browserLocale: 'ko-KR',
        loginAction: '로그인',
        signupAction: '독자로 가입하기',
        required: {
            username: '사용자 이름을 입력해 주세요.',
            displayName: '표시 이름을 입력해 주세요.',
            email: '이메일을 입력해 주세요.',
            password: '비밀번호를 입력해 주세요.',
            confirmPassword: '비밀번호를 한 번 더 입력해 주세요.'
        },
        invalid: {
            username: '영문 소문자와 숫자만 사용할 수 있습니다.',
            email: '올바른 이메일 주소를 입력해 주세요.',
            password: '비밀번호는 8자 이상이어야 합니다.'
        }
    }
] as const;

for (const locale of locales) {
    test.describe(`localized auth validation (${locale.browserLocale})`, () => {
        test.use({ locale: locale.browserLocale });

        test('keeps login and signup validation inside the product locale', async ({ page }) => {
            await page.goto('/login');
            await expect(page.locator('island-component[name="Login"]'))
                .toHaveAttribute('data-island-status', 'mounted');

            await page.getByRole('button', { name: locale.loginAction, exact: true }).click();

            await expect(page.getByText(locale.required.username, { exact: true })).toBeVisible();
            await expect(page.getByText(locale.required.password, { exact: true })).toBeVisible();
            await expect(page.locator('#username')).toHaveAttribute('aria-invalid', 'true');
            await expect(page.locator('#password')).toHaveAttribute('aria-invalid', 'true');

            await page.goto('/sign');
            await expect(page.locator('island-component[name="Signup"]'))
                .toHaveAttribute('data-island-status', 'mounted');

            let signupRequests = 0;
            page.on('request', (request) => {
                if (request.method() === 'POST' && new URL(request.url()).pathname === '/v1/sign') {
                    signupRequests += 1;
                }
            });

            await page.getByRole('button', { name: locale.signupAction, exact: true }).click();

            for (const message of Object.values(locale.required)) {
                await expect(page.getByText(message, { exact: true })).toBeVisible();
            }
            expect(signupRequests).toBe(0);

            await page.locator('#username').fill('Invalid');
            await page.locator('#name').fill('Writer');
            await page.locator('#email').fill('not-an-email');
            await page.locator('#password').fill('short');
            await page.locator('#confirm-password').fill('short');
            await page.getByRole('button', { name: locale.signupAction, exact: true }).click();

            for (const message of Object.values(locale.invalid)) {
                await expect(page.getByText(message, { exact: true })).toBeVisible();
            }
            expect(signupRequests).toBe(0);
        });
    });
}
