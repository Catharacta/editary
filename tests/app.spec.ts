import { test, expect } from '@playwright/test';

// Inject the mock logic
test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
        // This runs in the browser context
        window.__TAURI_IPC__ = async (...args: any[]) => {
            const message = args[0];
            const cmd = message?.cmd;
            const payload = message?.payload || {};

            console.log(`[MockIPC] Command: ${cmd}`, payload);

            if (cmd === 'open_file') {
                return {
                    path: payload.path,
                    content: '# Mock Content\nHello from Playwright',
                    encoding: 'utf-8',
                    stat: {
                        path: payload.path,
                        size: 100,
                        last_modified: Date.now(),
                    },
                };
            }
            if (cmd === 'save_file') {
                return { path: payload.path, size: payload.content?.length || 0, last_modified: Date.now() };
            }
            if (cmd.startsWith('plugin:event')) return null;

            return null;
        };
    });
});

test('App should render and editor should be visible', async ({ page }) => {
    await page.goto('/');

    // Check for title or key element
    await expect(page.locator('.app-container')).toBeVisible();

    // Check Activity Bar (sidebar)
    await expect(page.locator('.sidebar')).toBeVisible();

    // Click "New File" button
    await page.getByTitle('New File').click();

    // Check that the file list has an item
    await expect(page.locator('.file-item')).toBeVisible();

    // Check Editor is now visible
    await expect(page.locator('.cm-content')).toBeVisible();

    // Type some text
    await page.locator('.cm-content').click();
    await page.keyboard.type('Hello Playwright');

    // Check dirty indicator (circle)
    await expect(page.locator('.dirty-indicator')).toBeVisible();
});
