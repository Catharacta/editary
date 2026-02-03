import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
        // Mock IPC for file operations if needed (though split view is mostly client-side state)
        const mockIPC = async (...args: any[]) => {
            return null;
        };
        window.__TAURI_IPC__ = mockIPC;
        window.__TAURI_INTERNALS__ = { invoke: mockIPC };
        window.__TAURI__ = { invoke: mockIPC, transformCallback: (c: any) => c };
    });
});

test('Split View should toggle panes', async ({ page }) => {
    await page.goto('/');

    // 1. Initial State
    // Should have only one pane-container (primary)
    await expect(page.locator('.pane-container')).toHaveCount(1);

    // 2. Enable Split
    const splitButton = page.getByTitle('Split Editor');
    await expect(splitButton).toBeVisible();
    await splitButton.click();

    // 3. Verify Split State
    // Should now have two pane-containers
    await expect(page.locator('.pane-container')).toHaveCount(2);

    // Verify visual separator
    // We expect a div with width 1px and background var(--border-color)
    // It's hard to target by style, but we can check if there's a divider div.
    // In App.tsx: <div style={{ width: '1px', background: 'var(--border-color)' }}></div>
    // Let's assume the count increase is sufficient for structure check, or check structure more closely if needed.

    // Check Toolbar button changed to 'Close Split'
    await expect(page.getByTitle('Close Split')).toBeVisible();
    await expect(page.getByTitle('Split Editor')).toBeHidden();

    // 4. Disable Split
    await page.getByTitle('Close Split').click();

    // 5. Verify Revert
    await expect(page.locator('.pane-container')).toHaveCount(1);
    await expect(page.getByTitle('Split Editor')).toBeVisible();
});
