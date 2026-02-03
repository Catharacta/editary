import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
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

            if (cmd === 'plugin:dialog|open') {
                if (payload?.directory || payload?.options?.directory || payload?.recursive) {
                    return 'c:/mock/project';
                }
                return 'c:/mock/file.txt';
            }

            if (cmd === 'read_dir' || cmd === 'plugin:fs|read_dir') {
                // Return minimal structure to satisfy file tree and avoid crashes
                return [
                    { name: 'src', path: 'c:/mock/project/src', children: [], isDirectory: true, isFile: false },
                    { name: 'App.tsx', path: 'c:/mock/project/src/App.tsx', isDirectory: false, isFile: true }
                ];
            }

            if (cmd === 'search_files') {
                const query = payload.query || '';
                return [
                    { file_path: 'c:/mock/project/src/App.tsx', line_number: 10, line_content: `const title = "${query}";` },
                    { file_path: 'c:/mock/project/src/Utils.ts', line_number: 5, line_content: `// TODO: fix ${query}` }
                ];
            }

            if (cmd === 'replace_files') {
                // Validate parameters
                const query = payload.query;
                const replaceWith = payload.replacement;
                const dryRun = payload.dryRun;

                if (dryRun) {
                    // Return preview results
                    return [
                        {
                            file_path: 'c:/mock/project/src/App.tsx',
                            matches: [
                                { line: 10, original: `const title = "${query}";`, replacement: `const title = "${replaceWith}";` }
                            ],
                            replaced_count: 0
                        },
                        {
                            file_path: 'c:/mock/project/src/Utils.ts',
                            matches: [
                                { line: 5, original: `// TODO: fix ${query}`, replacement: `// TODO: fix ${replaceWith}` }
                            ],
                            replaced_count: 0
                        }
                    ];
                } else {
                    // Return success execution results (usually empty matches or special indication)
                    // In real backend, execute returns modified results or count. 
                    // Frontend expects array of results to clear or show.
                    // The current impl simply returns empty array or handled result? 
                    // Let's assume it returns empty results to indicate "done" or updated state.
                    // Actually, if it's not dry_run, we might just return empty vector or minimal info.
                    return [];
                }
            }

            return null;
        };

        window.__TAURI_IPC__ = mockIPC;
        window.__TAURI_INTERNALS__ = { invoke: mockIPC };
        window.__TAURI__ = { transformCallback: (c: any) => c, invoke: mockIPC };
    });
});

test('Replace Panel - Dry Run and Execution Flow', async ({ page }) => {
    // 1. Setup: Open Project
    await page.goto('/');
    await page.getByRole('button', { name: 'Open Folder' }).first().click();
    await expect(page.locator('.project-section .header-title')).toContainText('project');

    // 2. Open Search Panel
    await page.locator('.activity-icon[title="Search"]').click();

    // 3. Toggle Replace Mode
    // Initially replace input should be hidden
    await expect(page.getByPlaceholder('Replace')).toBeHidden();

    // Click toggle button (chevron)
    await page.locator('.toggle-replace-icon').click();
    await expect(page.getByPlaceholder('Replace')).toBeVisible();

    // 4. Fill Search and Replace
    await page.getByPlaceholder('Search').fill('TestQuery');
    await page.getByPlaceholder('Replace').fill('NewValue');

    // 5. Trigger Preview (Dry Run)
    // Dry run usually triggers automatically or via button if results are empty? 
    // In current impl, "Show Preview" button appears if search executed but replace results empty?
    // Or we hit "Enter" on search input?
    // Let's first search to see normal results
    await page.getByPlaceholder('Search').press('Enter');

    // Wait for search to complete (inferred by preview button appearing)
    // In Replace Mode, results are hidden until preview is shown.

    // Now, trigger "Show Preview" if it exists, OR effectively we need to know how preview is triggered.
    // In logic: if (isReplaceMode && replaceResults.length === 0 && !isSearching && query) -> Show Preview button
    const previewBtn = page.getByRole('button', { name: 'Show Preview' });
    await expect(previewBtn).toBeVisible();
    await previewBtn.click();

    // 6. Verify Preview Results (Diff View)
    // Look for .replace-diff elements
    await expect(page.locator('.replace-diff')).toHaveCount(2);
    // Check content of diff
    await expect(page.locator('.replace-diff .original').first()).toContainText('TestQuery');
    await expect(page.locator('.replace-diff .replacement').first()).toContainText('NewValue');

    // 7. Execute Replace
    // Handle confirm dialog
    page.on('dialog', dialog => dialog.accept());

    await page.getByTitle('Replace All (Ctrl+Alt+Enter)').click();

    // 8. Verify Completion
    // Expect results to be cleared or success message
    // Implementation sets error message to "Replacement complete!"
    await expect(page.locator('.search-error')).toContainText('Replacement complete!');
});
