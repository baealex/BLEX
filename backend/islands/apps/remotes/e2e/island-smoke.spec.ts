import { expect, test, type Page } from '@playwright/test';

const interactivePages = [
    { path: '/login', islandName: 'Login' },
    { path: '/sign', islandName: 'Signup' }
] as const;

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

    page.on('response', (response) => {
        const url = response.url();

        if (response.status() >= 400 && url.includes('/resources/staticfiles/islands/')) {
            errors.push(`asset ${response.status()}: ${url}`);
        }
    });

    return errors;
};

const expectIslandBootstrap = async (page: Page) => {
    await page.waitForFunction(() => Boolean(customElements.get('island-component')));
    await expect(page.locator('#blex-island-monitor-alert')).toHaveCount(0);
};

const expectNoRuntimeErrors = (errors: string[]) => {
    expect(errors, errors.join('\n')).toEqual([]);
};

test.describe('island production smoke', () => {
    test('home loads the production island bootstrap without runtime errors', async ({ page }) => {
        const errors = collectRuntimeSignals(page);

        await page.goto('/');
        await expectIslandBootstrap(page);
        await expect(page.locator('script[src*="/resources/staticfiles/islands/island."]')).toHaveCount(1);

        expectNoRuntimeErrors(errors);
    });

    for (const { path, islandName } of interactivePages) {
        test(`${path} mounts ${islandName} island`, async ({ page }) => {
            const errors = collectRuntimeSignals(page);

            await page.goto(path);
            await expectIslandBootstrap(page);

            const island = page.locator(`island-component[name="${islandName}"]`);
            await expect(island).toHaveAttribute('data-island-status', 'mounted');

            expectNoRuntimeErrors(errors);
        });
    }

    test('global toast mounts its renderer on demand', async ({ page }) => {
        const errors = collectRuntimeSignals(page);

        await page.goto('/');
        await expectIslandBootstrap(page);
        await page.evaluate(() => window.toast.success('Smoke toast'));

        const toaster = page.locator('island-component[name="Toaster"]');
        await expect(toaster).toHaveAttribute('data-island-status', 'mounted');

        expectNoRuntimeErrors(errors);
    });

    test('login prompt island can be mounted on demand', async ({ page }) => {
        const errors = collectRuntimeSignals(page);

        await page.goto('/');
        await expectIslandBootstrap(page);
        await page.evaluate(() => {
            const loginPrompt = document.createElement('island-component');
            loginPrompt.setAttribute('name', 'LoginPrompt');
            loginPrompt.setAttribute('props', encodeURIComponent(JSON.stringify({
                isOpen: true,
                action: '스모크 테스트'
            })));
            document.body.appendChild(loginPrompt);
        });

        const loginPrompt = page.locator('island-component[name="LoginPrompt"]');
        await expect(loginPrompt).toHaveAttribute('data-island-status', 'mounted');
        await expect(page.locator('h3', { hasText: '로그인이 필요해요' })).toBeVisible();

        expectNoRuntimeErrors(errors);
    });
});
