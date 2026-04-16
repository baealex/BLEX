import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:8000';
const shouldStartServer = !process.env.E2E_BASE_URL && process.env.E2E_SKIP_WEB_SERVER !== '1';
const shouldReuseServer = process.env.PLAYWRIGHT_REUSE_SERVER === '1';

export default defineConfig({
    testDir: './e2e',
    timeout: 30_000,
    fullyParallel: false,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 1 : 0,
    reporter: process.env.CI ? [['github'], ['list']] : [['list']],
    expect: {
        timeout: 10_000
    },
    use: {
        baseURL,
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure',
        video: 'retain-on-failure'
    },
    webServer: shouldStartServer
        ? {
            command: 'bash scripts/run-smoke-server.sh',
            url: baseURL,
            timeout: 120_000,
            reuseExistingServer: shouldReuseServer,
            stdout: process.env.CI ? 'ignore' : 'pipe',
            stderr: 'pipe'
        }
        : undefined,
    projects: [
        {
            name: 'chromium',
            use: {
                ...devices['Desktop Chrome']
            }
        }
    ]
});
