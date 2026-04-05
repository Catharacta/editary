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

window.__electrobun_encrypt = async (msg: string) => ({
    encryptedData: msg,
    iv: "mock-iv",
    tag: "mock-tag"
});

window.__electrobun_decrypt = async (data: any) => data.encryptedData;

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

// Mock IntersectionObserver
global.IntersectionObserver = class {
    constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {}
    observe(target: Element) {}
    unobserve(target: Element) {}
    disconnect() {}
} as any;

global.DOMParser = class {
    parseFromString(markup: string, type: any) {
        const doc = new GlobalWindow().document;
        doc.body.innerHTML = markup;
        return doc;
    }
} as any;

import { mock } from "bun:test";

// Mock Worker
global.Worker = mock(function WorkerMock(this: any, stringUrl: string | URL, options?: WorkerOptions) {
    this.onmessage = null;
    this.onerror = null;
    this.listeners = {};

    this.postMessage = (message: any, transfer?: any): void => {};
    this.terminate = (): void => {};

    this.addEventListener = (type: string, listener: Function) => {
        this.listeners[type] = this.listeners[type] || [];
        this.listeners[type].push(listener);
    };

    this.removeEventListener = (type: string, listener: Function) => {
        if (this.listeners[type]) {
            this.listeners[type] = this.listeners[type].filter((l: any) => l !== listener);
        }
    };

    this.dispatchEvent = (event: Event) => true;

    // Helper to trigger listeners in tests
    this._trigger = (type: string, event: any) => {
        if (this.listeners[type]) {
            this.listeners[type].forEach((l: any) => l(event));
        }
        if (type === 'message' && this.onmessage) {
            this.onmessage(event);
        }
    };
    
    return this;
}) as any;
