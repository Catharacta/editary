import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
        // Mock function capable of handling both Tauri v2 calls and legacy/IPC styles
        const mockIPC = async (...args: any[]) => {
            let cmd, payload;
            if (typeof args[0] === 'string') {
                // v2 internal invoke signature: (cmd, payload, options)
                cmd = args[0];
                payload = args[1] || {};
            } else {
                // v1 or IPC message style
                const message = args[0];
                cmd = message?.cmd;
                payload = message?.payload || {};
            }

            console.log(`[MockIPC] Command: ${cmd}`, payload);

            if (cmd === 'search_files') {
                const query = payload.query || '';
                if (query === 'no-match') return [];
                return [
                    { file_path: 'src/App.tsx', line_number: 10, line_content: `console.log("${query}")` },
                    { file_path: 'src/components/Sidebar.tsx', line_number: 5, line_content: `// Search result for ${query}` }
                ];
            }

            if (cmd === 'plugin:dialog|open') {
                // Robust payload check for open folder
                if (payload?.directory || payload?.options?.directory || payload?.recursive) {
                    return 'c:/mock/project';
                }
                return 'c:/mock/file.txt';
            }

            if (cmd === 'read_dir') {
                return [
                    { name: 'src', path: 'c:/mock/project/src', children: [] },
                    { name: 'package.json', path: 'c:/mock/project/package.json', children: null }
                ];
            }
            // Sometimes it might be plugin:fs|read_dir
            if (cmd === 'plugin:fs|read_dir') {
                return [
                    { name: 'src', path: 'c:/mock/project/src', isDirectory: true, isFile: false },
                    { name: 'package.json', path: 'c:/mock/project/package.json', isDirectory: false, isFile: true }
                ];
            }

            if (cmd === 'open_file') {
                return {
                    path: payload.path,
                    content: 'Mock Content',
                    encoding: 'utf-8',
                    stat: { path: payload.path, size: 100, last_modified: Date.now() },
                };
            }

            if (cmd && cmd.startsWith('plugin:event')) return null;

            return null;
        };

        // Polyfill for Tauri v2 API internals
        window.__TAURI_IPC__ = mockIPC;
        window.__TAURI_INTERNALS__ = {
            invoke: mockIPC,
        };
        // Polyfill for older patterns/fallbacks or plugins checking global
        window.__TAURI__ = {
            transformCallback: (c: any) => c,
            invoke: mockIPC,
        };

        console.log('[MockIPC] Initialized mocks. __TAURI_INTERNALS__:', !!window.__TAURI_INTERNALS__);
    });
});

test('Search Panel should open and execute search', async ({ page }) => {
    page.on('console', msg => console.log(`PAGE LOG: ${msg.text()}`));
    await page.goto('/');

    // 1. Open Project (Folder) to enable search
    // Click "Open Folder" in Empty Explorer (if no project open) or Action Row
    // Since mock starts empty, we should see "Open Folder" button in .empty-explorer
    await page.getByRole('button', { name: 'Open Folder' }).first().click();

    // Verify Project Loaded (Strict check)
    // Expect empty state to disappear
    await expect(page.locator('.empty-explorer')).toBeHidden();

    // Also check header text more strictly if possible, or just rely on empty-explorer being gone.
    // 'c:/mock/project' should result in project name 'project'
    await expect(page.locator('.project-section .header-title')).toContainText('project');

    // 2. Open Search Panel
    // Look for Activity Bar search icon
    const searchTab = page.locator('.activity-icon[title="Search"]');
    await searchTab.click();

    // 3. Check Search Input visibility
    const searchInput = page.getByPlaceholder('Search');
    await expect(searchInput).toBeVisible();

    // 4. Type Query
    await searchInput.fill('test');
    await page.keyboard.press('Enter');

    // 5. Verify Results
    await expect(page.locator('.search-result-item')).toHaveCount(2);
    await expect(page.locator('.search-result-item').first()).toContainText('src/App.tsx');
});
