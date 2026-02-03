// tests/mocks/tauri.ts

export const mockTauriIPC = (window: any) => {
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

        if (cmd === 'read_dir' || cmd === 'plugin:fs|read_dir') {
            return [
                { name: 'src', path: 'c:/mock/project/src', children: [] },
                { name: 'package.json', path: 'c:/mock/project/package.json', children: null } // simplified
            ];
        }

        if (cmd === 'plugin:dialog|open') {
            // Robust payload check
            if (payload?.directory || payload?.options?.directory || payload?.recursive) {
                return 'c:/mock/project';
            }
            return 'c:/mock/file.txt';
        }

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
            return {
                path: payload.path,
                size: payload.content?.length || 0,
                last_modified: Date.now(),
            };
        }

        if (cmd === 'watch_file' || cmd === 'unwatch_file') return null;
        if (cmd === 'get_recent_files') return [];

        if (cmd && cmd.startsWith('plugin:event')) return 12345;

        // Default fallback
        // console.warn(`[MockIPC] Unhandled command: ${cmd}`);
        return null;
    };

    // Polyfill for Tauri v2 API internals
    window.__TAURI_IPC__ = mockIPC;
    window.__TAURI_INTERNALS__ = {
        invoke: mockIPC,
    };
    // Polyfill for older patterns/fallbacks
    window.__TAURI__ = {
        transformCallback: (c: any) => c,
        invoke: mockIPC,
    };
};
