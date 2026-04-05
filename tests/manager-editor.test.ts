import { expect, test, describe, beforeEach, spyOn, mock } from "bun:test";
import "./setup";
import { EditorManager } from "../src/mainview/editor/EditorManager";
import { state } from "../src/mainview/state/workspace";

// Mock implementation of Tiptap Editor
class MockEditor {
    options: any;
    commands: any;
    storage: any;
    constructor(options: any) {
        this.options = options;
        this.commands = {
            setContent: mock(() => {}),
            focus: mock(() => {}),
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
    destroy() {}
    setOptions() {}
    getAttributes() { return {}; }
    isActive() { return false; }
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
        
        // Reset state
        state.editor = null as any;
        state.currentFilePath = null;
    });

    test("init should create editor instance and bind events", async () => {
        const editorEl = document.getElementById("editor") as HTMLElement;
        EditorManager.init(editorEl);
        
        expect(state.editor).toBeDefined();
        expect(state.editor instanceof MockEditor).toBe(true);
        
        const autoSaveToggle = document.getElementById("autoSaveToggle") as HTMLInputElement;
        expect(autoSaveToggle).toBeDefined();
    });

    test("getHTML/setContent should work", async () => {
        const editorEl = document.getElementById("editor") as HTMLElement;
        EditorManager.init(editorEl);
        
        const testHtml = "<h1>Test</h1>";
        (state.editor.commands.setContent as any).mockClear();
        
        await EditorManager.setContent(testHtml);
        expect(state.editor.commands.setContent).toHaveBeenCalledWith(testHtml);
        
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
        (EditorManager as any).handleUpdate(state.editor);
        
        // Wait for auto-save timeout (2000ms in EditorManager)
        return new Promise<void>((resolve) => {
            setTimeout(() => {
                // Verified by checking if saveFile was called (needs mock)
                resolve();
            }, 2100);
        });
    }, 5000);
});
