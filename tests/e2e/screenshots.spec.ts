import { test, expect } from '@playwright/test';

test.describe('Spritz Voice UI', () => {
    test('capture screenshots of main pages', async ({ page }) => {
        // 1. Load Application
        await page.goto('./');
        await expect(page).toHaveTitle(/Spritz Voice/);

        // Wait for the indexedDB/seeding to complete and library to show
        await page.waitForSelector('.document-list-container');

        // 2. Library View
        await page.screenshot({ path: 'tests/e2e/screenshots/01-library.png', fullPage: true });

        // 3. Reader View (Open first document)
        const firstDoc = page.locator('.document-item').first();
        const resumeBtn = firstDoc.locator('button[title="Start"], button[title="Resume"]');
        await resumeBtn.click();

        // Wait for the reader view to mount
        await page.waitForSelector('.main-view');

        // Ensure we are in Paragraph view first for a good screenshot
        await page.click('button[data-view="PARAGRAPH"]');
        await page.waitForTimeout(500);
        await page.screenshot({ path: 'tests/e2e/screenshots/02-reader-paragraph.png', fullPage: true });

        // 4. RSVP View
        await page.click('button[data-view="RSVP"]');
        await page.waitForTimeout(500);
        await page.screenshot({ path: 'tests/e2e/screenshots/03-reader-rsvp.png', fullPage: true });

        // 5. Focus View
        await page.click('button[data-view="FOCUS"]');
        await page.waitForTimeout(500);
        await page.screenshot({ path: 'tests/e2e/screenshots/04-reader-focus.png', fullPage: true });

        // 6. Settings
        await page.setViewportSize({ width: 1280, height: 1600 }); // Increase height for full settings
        await page.click('#btn-settings');
        await page.waitForSelector('.settings-modal');
        await page.screenshot({ path: 'tests/e2e/screenshots/05-settings.png' });
        await page.setViewportSize({ width: 1280, height: 720 }); // Restore standard


        // 7. New Document
        await page.click('#close-settings');
        await page.waitForSelector('.settings-modal', { state: 'hidden' });

        await page.click('#btn-new-text');
        await page.waitForSelector('.text-input-container');
        await page.screenshot({ path: 'tests/e2e/screenshots/06-new-document.png', fullPage: true });
    });
});
