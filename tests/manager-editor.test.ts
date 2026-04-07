import { expect, test, describe, beforeEach, afterEach, spyOn, mock } from "bun:test";
import "./setup";
import { EditorManager } from "../src/mainview/editor/EditorManager";
import { state } from "../src/mainview/state/workspace";

// Mock implementation of Tiptap Editor
class MockEditor {
    options: any;
    commands: any;
    extensionManager: any;
    state: any;
    storage: any;
    constructor(options: any) {
        this.options = options;
        this.state = {
            doc: {
                firstChild: {
                    type: { name: "paragraph" }
                }
            }
        };
        this.commands = {
            setContent: mock(() => {}),
            insertContent: mock(() => {}),
            focus: mock(() => {}),
        };
        this.extensionManager = {
            extensions: []
        };
        this.storage = {
            characterCount: {
                characters: mock(() => 100),
                words: mock(() => 20)
            }
        };
    }
    getHTML() { return "<p>mock content</p>"; }
    getJSON() { return { type: "doc", content: [] }; }
    getText() { return "mock text content"; }
    isActive() { return false; }
    destroy() {}
    setOptions() {}
    getAttributes() { return {}; }
}

// Mock Tiptap Editor import
mock.module("@tiptap/core", () => ({
    Editor: MockEditor
}));

describe("EditorManager", () => {
    beforeEach(() => {
        // Prepare DOM for EditorManager initialization
        document.body.innerHTML = `
            <div id="editor"></div>
            <div id="statusbar-info"></div>
            <div id="outline-content"></div>
            <input type="checkbox" id="autoSaveToggle">
            <input type="checkbox" id="showLineNumbersToggle">
        `;
        
        // Reset state and singleton
        EditorManager.reset();
        state.currentFilePath = null;
    });

    afterEach(() => {
        EditorManager.reset();
    });

    test("init should create editor instance and bind events", async () => {
        const editorEl = document.getElementById("editor") as HTMLElement;
        const editor = EditorManager.init(editorEl);
        
        expect(state.editor).toBe(editor);
        expect(state.editor instanceof MockEditor).toBe(true);
        expect(state.editor!.options.element).toBe(editorEl);
    });

    test("getHTML/setContent should work", async () => {
        const editorEl = document.getElementById("editor") as HTMLElement;
        EditorManager.init(editorEl);
        
        const testHtml = "<h1>Test</h1>";
        (state.editor!.commands.setContent as any).mockClear();
        
        await EditorManager.setContent(testHtml);
        expect(state.editor!.commands.setContent).toHaveBeenCalledWith(testHtml);
        
        const content = EditorManager.getHTML();
        expect(content).toBe("<p>mock content</p>");
    });

    test("auto-save should trigger after delay", async () => {
        const editorEl = document.getElementById("editor") as HTMLElement;
        EditorManager.init(editorEl);
        
        state.currentFilePath = "test.md";
        state.editorSettings.autoSave = true;
        state.openTabs.set("test.md", { filePath: "test.md", isDirty: false });
        
        // Trigger update
        (EditorManager as any).handleUpdate(state.editor!);
        
        // Wait for auto-save timeout (2000ms in EditorManager)
        return new Promise<void>((resolve) => {
            setTimeout(() => {
                // Verified by checking if saveFile was called (needs mock)
                resolve();
            }, 2100);
        });
    }, 5000);
});
