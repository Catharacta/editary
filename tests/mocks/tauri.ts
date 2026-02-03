// tests/mocks/tauri.ts

export const mockTauriIPC = (window: any) => {
    // Basic Mock for Tauri v2 IPC
    window.__TAURI_IPC__ = async (...args: any[]) => {
        const message = args[0];
        const cmd = message?.cmd;
        const payload = message?.payload || {};

        console.log(`[MockIPC] Command: ${cmd}`, payload);

        switch (cmd) {
            case 'open_file':
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
            case 'save_file':
                return {
                    path: payload.path,
                    size: payload.content?.length || 0,
                    last_modified: Date.now(),
                };
            case 'watch_file':
            case 'unwatch_file':
                return null;
            case 'get_recent_files':
                return [];
            // Mocking event plugin
            case 'plugin:event|listen':
                return 12345;
            case 'plugin:event|unlisten':
                return null;
            default:
                // Log unhandled commands
                console.warn(`[MockIPC] Unhandled command: ${cmd}`);
                return null;
        }
    };
};
