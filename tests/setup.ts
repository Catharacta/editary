import { GlobalWindow } from "happy-dom";

// Initialize Happy DOM
const window = new GlobalWindow() as any;
global.window = window;
global.document = window.document;
global.navigator = window.navigator;
global.HTMLElement = window.HTMLElement;
global.HTMLInputElement = window.HTMLInputElement;
global.HTMLTextAreaElement = window.HTMLTextAreaElement;
global.Node = window.Node;

// Mock electrobun environment
window.__electrobun = {
    receiveMessageFromBun: () => {},
    receiveInternalMessageFromBun: () => {},
};

// Mock WebSocket for electrobun
global.WebSocket = class {
    constructor() {}
    send() {}
    close() {}
    addEventListener() {}
    removeEventListener() {}
} as any;

// Mock localStorage
global.localStorage = {
    getItem: (key: string) => null,
    setItem: (key: string, value: string) => {},
    clear: () => {},
    removeItem: (key: string) => {},
    length: 0,
    key: (index: number) => null,
};

// Mock fetch
(global as any).fetch = async (url: string) => {
    return {
        ok: true,
        json: async () => ({}),
    } as any;
};
