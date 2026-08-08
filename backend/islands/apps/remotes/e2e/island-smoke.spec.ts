import { expect, test, type Page } from '@playwright/test';

const interactivePages = [
    { path: '/login', islandName: 'Login' },
    { path: '/sign', islandName: 'Signup' }
] as const;
const expectProductionMode = process.env.E2E_EXPECT_PRODUCTION === '1';

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

const isIslandRuntimeUrl = (url: string) =>
    /\/island\.[A-Za-z0-9_-]+\.js$/.test(new URL(url).pathname);

test.describe('island production smoke', () => {
    test('home defers the React island runtime when no island is present', async ({ page }) => {
        const errors = collectRuntimeSignals(page);
        const runtimeResponses: string[] = [];
        const pretendardResponses: string[] = [];

        page.on('response', (response) => {
            if (isIslandRuntimeUrl(response.url())) {
                runtimeResponses.push(response.url());
            }

            if (response.url().includes('/Pretendard-')) {
                pretendardResponses.push(response.url());
            }
        });

        await page.goto('/');
        await page.waitForLoadState('networkidle');

        expect(await page.evaluate(() => Boolean(customElements.get('island-component')))).toBe(false);
        expect(await page.evaluate(() => typeof window.toast)).toBe('function');
        if (expectProductionMode) {
            await expect(page.locator('[aria-label="개발 환경 표시"]')).toHaveCount(0);
        }
        await expect(page.locator('link[rel="modulepreload"][href*="islandLoader."]')).toHaveCount(1);
        await expect(page.locator('script[src*="islandLoader."]')).toHaveCount(1);
        expect(runtimeResponses).toEqual([]);
        expect(pretendardResponses).toEqual([]);

        expectNoRuntimeErrors(errors);
    });

    for (const { path, islandName } of interactivePages) {
        test(`${path} mounts ${islandName} island`, async ({ page }) => {
            const errors = collectRuntimeSignals(page);

            await page.goto(path);
            await expectIslandBootstrap(page);

            const island = page.locator(`island-component[name="${islandName}"]`);
            await expect(island).toHaveAttribute('data-island-status', 'mounted');
            await expect(island.locator('[data-island-fallback]')).toHaveCount(0);

            expectNoRuntimeErrors(errors);
        });
    }

    test('mounts a zero-height lazy island after the runtime is already active', async ({ page }) => {
        const errors = collectRuntimeSignals(page);

        await page.goto('/login');
        await expectIslandBootstrap(page);
        await expect(page.locator('island-component[name="Login"]'))
            .toHaveAttribute('data-island-status', 'mounted');

        await page.evaluate(() => {
            const spacer = document.createElement('div');
            spacer.style.height = '200vh';
            document.body.appendChild(spacer);

            const lazyIsland = document.createElement('island-component');
            lazyIsland.id = 'lazy-island-smoke';
            lazyIsland.setAttribute('name', 'LoginPrompt');
            lazyIsland.setAttribute('lazy', 'true');
            lazyIsland.setAttribute('props', encodeURIComponent(JSON.stringify({
                isOpen: false,
                action: 'generic'
            })));
            document.body.appendChild(lazyIsland);
        });

        const lazyIsland = page.locator('#lazy-island-smoke');
        await expect(lazyIsland).toHaveAttribute('data-island-status', 'pending');
        await page.evaluate(() => window.scrollTo({
            top: document.documentElement.scrollHeight,
            behavior: 'instant'
        }));
        await expect(lazyIsland).toHaveAttribute('data-island-status', 'mounted');

        expectNoRuntimeErrors(errors);
    });

    test('global toast mounts its renderer on demand', async ({ page }) => {
        const errors = collectRuntimeSignals(page);

        await page.goto('/');
        await page.evaluate(() => window.toast.success('Smoke toast'));

        const toaster = page.locator('island-component[name="Toaster"]');
        await expect(toaster).toHaveAttribute('data-island-status', 'mounted');
        await expectIslandBootstrap(page);

        expectNoRuntimeErrors(errors);
    });

    test('login prompt island can be mounted on demand', async ({ page }) => {
        const errors = collectRuntimeSignals(page);

        await page.goto('/');
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
        await expectIslandBootstrap(page);

        expectNoRuntimeErrors(errors);
    });
});
