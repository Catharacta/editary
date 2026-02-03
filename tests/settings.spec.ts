import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
    // Inject Mock
    await page.addInitScript(() => {
        window.localStorage.setItem('editary-settings', JSON.stringify({}));

        const mockIPC = async (...args: any[]) => {
            let cmd, payload;
            if (typeof args[0] === 'string') {
                cmd = args[0];
                payload = args[1] || {};
            } else {
                const message = args[0];
                cmd = message?.cmd;
                payload = message?.payload || {};
            }

            console.log(`[MockIPC] Command: ${cmd}`, payload);

            if (cmd === 'plugin:store|load') {
                return {
                    // Mock Store ID
                    rid: 123
                };
            }
            if (cmd === 'plugin:store|get') {
                // Mock getting values
                if (payload.key === 'theme') return 'dark';
                return null;
            }
            if (cmd === 'plugin:store|set') {
                return null;
            }
            if (cmd === 'plugin:store|save') {
                return null;
            }

            return null;
        };

        window.__TAURI_IPC__ = mockIPC;
        window.__TAURI_INTERNALS__ = { invoke: mockIPC };
        window.__TAURI__ = { invoke: mockIPC, transformCallback: (c: any) => c };
    });
});

test('Settings View should open, switch sections, and toggle theme', async ({ page }) => {
    await page.goto('/');

    // 1. Open Settings
    // Find settings button in Toolbar
    await page.getByTitle('Settings').click();

    // Verify Settings View is visible
    await expect(page.locator('.settings-view')).toBeVisible();
    await expect(page.locator('.settings-title')).toHaveText('General Settings');

    // 2. Switch Sections
    await page.locator('.settings-nav-item', { hasText: 'Search' }).click();
    await expect(page.locator('.settings-title')).toHaveText('Search Settings');
    await expect(page.locator('h3', { hasText: 'Search Limits' })).toBeVisible();

    await page.locator('.settings-nav-item', { hasText: 'About' }).click();
    await expect(page.locator('.settings-title')).toHaveText('About Editary');

    // 3. Toggle Theme
    // Go back to General
    await page.locator('.settings-nav-item', { hasText: 'General' }).click();

    // Check initial state (mock returns 'dark')
    // We expect .theme-card.selected to be Dark
    await expect(page.locator('.theme-card', { hasText: 'Dark' })).toHaveClass(/selected/);

    // Switch to Light
    await page.locator('.theme-card', { hasText: 'Light' }).click();

    // Verify selection change
    await expect(page.locator('.theme-card', { hasText: 'Light' })).toHaveClass(/selected/);
    await expect(page.locator('.theme-card', { hasText: 'Dark' })).not.toHaveClass(/selected/);

    // Verify global theme application (document body class)
    await expect(page.locator('body')).toHaveClass(/light-theme/);
});
