import { test, expect } from '@playwright/test';

test.describe('Visual Regression Testing', () => {
    test.beforeEach(async ({ page }) => {
        // Navigate to the app
        page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
        page.on('pageerror', err => console.log('BROWSER ERROR:', err.message));
        await page.goto('./');
        // Wait for the app to initialize
        await page.waitForSelector('.document-list-container');

        // Stability: Hide the voice warning which might be non-deterministic (appears/disappears)
        await page.addStyleTag({
            content: `
        .voice-warning { display: none !important; }
        * { transition: none !important; animation: none !important; }
      `
        });
    });

    test('Library View should match baseline', async ({ page }) => {
        await expect(page).toHaveScreenshot('library-view.png', { fullPage: true });
    });

    test('Reader Paragraph View should match baseline', async ({ page }) => {
        const firstDoc = page.locator('.document-item').first();
        await firstDoc.locator('button[title="Start"], button[title="Resume"]').click();
        await page.waitForSelector('.main-view');
        await page.waitForSelector('.loading-overlay.visible', { state: 'hidden' });
        await page.click('#drawer-handle');
        await page.click('label:has(input[data-view="PARAGRAPH"])');
        await page.click('#drawer-close');

        // Mask the progress bar if it's too jittery, but for static seeds it should be fine
        await expect(page).toHaveScreenshot('reader-paragraph.png', {
            fullPage: true,
            mask: [page.locator('.time-display')] // Time can vary slightly
        });
    });

    test('Settings Modal should match baseline', async ({ page }) => {
        await page.setViewportSize({ width: 1280, height: 1600 });
        await page.click('#btn-settings');
        await page.waitForSelector('.settings-modal');
        await expect(page.locator('.settings-modal')).toHaveScreenshot('settings-modal.png');
    });

    test('New Document View should match baseline', async ({ page }) => {
        await page.click('#btn-new-text');
        await page.waitForSelector('.text-input-container');
        await expect(page).toHaveScreenshot('new-document-view.png', { fullPage: true });
    });
});
