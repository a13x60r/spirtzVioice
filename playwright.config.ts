import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
    testDir: './tests/e2e',
    snapshotPathTemplate: '{testDir}/{testFileDir}/{testFileName}-snapshots/{arg}{-projectName}{ext}',
    timeout: 90000,
    globalTeardown: './tests/e2e/playwright.teardown.ts',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : undefined,
    reporter: 'html',
    use: {
        baseURL: 'http://localhost:5180/spirtzVioice/',
        trace: 'on-first-retry',
    },
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
    ],
    expect: {
        toHaveScreenshot: {
            maxDiffPixelRatio: 0.05,
        },
    },
    webServer: {
        command: 'npm run dev',
        url: 'http://localhost:5180/spirtzVioice/',
        reuseExistingServer: !process.env.CI,
        timeout: 120000,
    },
});
