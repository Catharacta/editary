import { describe, it, expect, beforeEach } from "bun:test";
import { Editor } from "@tiptap/core";
import { getExtensions } from "../src/mainview/editor/extensions/index";
import { GlobalRegistrar } from "../src/mainview/utils/GlobalRegistrar";

// Mock globals for tests
if (typeof document === 'undefined') {
    const { JSDOM } = require('jsdom');
    const dom = new JSDOM('<!DOCTYPE html><html><body><div id="editor"></div></body></html>');
    (global as any).window = dom.window;
    (global as any).document = dom.window.document;
    (global as any).navigator = dom.window.navigator;
    (global as any).HTMLElement = dom.window.HTMLElement;
}

describe("Hyphen Conversion Repro", () => {
    let editor: Editor;

    beforeEach(() => {
        const element = document.createElement("div");
        editor = new Editor({
            element,
            extensions: getExtensions(),
        });
    });

    it("should NOT convert - to a bullet list immediately without space", () => {
        editor.commands.setContent("<p></p>");
        editor.commands.focus();
        
        // Simulate typing '-'
        editor.commands.insertContent("-");
        
        // Check if it's still a paragraph or if it became a list
        expect(editor.isActive("bulletList")).toBe(false);
        expect(editor.state.doc.firstChild?.type.name).toBe("paragraph");
    });

    it("should NOT convert - plus space to a bullet list if followed by [", () => {
        editor.commands.setContent("<p></p>");
        
        // Simulate typing '- ['
        // Note: Input rules are harder to trigger via commands, but we can check the regexes from extensions
        const bulletList = editor.extensionManager.extensions.find(e => e.name === 'bulletList');
        const inputRules = bulletList?.options.addInputRules?.() || [];
        // (Wait, addInputRules is private/internal in Tiptap usually)
    });
});
