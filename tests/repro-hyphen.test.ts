import "./setup";
import { describe, it, expect, beforeEach } from "bun:test";
import { Editor } from "@tiptap/core";
import { getExtensions } from "../src/mainview/editor/extensions/index";

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
        
        // Simulate typing '-'
        editor.commands.insertContent("-");
        
        // Check if it's still a paragraph or if it became a list
        expect(editor.isActive("bulletList")).toBe(false);
        expect(editor.state.doc.firstChild?.type.name).toBe("paragraph");
    });
});
