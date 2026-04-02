import { expect, test, describe, beforeEach } from "bun:test";
import "./setup";
import { setupToolbar } from "../src/mainview/editor/toolbar";
import { state } from "../src/mainview/state/workspace";

describe("Toolbar", () => {
    let boldBtn: HTMLElement;
    let inlineMathBtn: HTMLElement;
    let mockEditor: any;

    beforeEach(() => {
        document.body.innerHTML = `
            <div id="updateContentBtn"></div>
            <div id="boldBtn"></div>
            <div id="inlineMathBtn"></div>
            <div id="mathBlockBtn"></div>
            <div id="italicBtn"></div>
            <div id="codeInlineBtn"></div>
            <div id="h1Btn"></div>
            <div id="h2Btn"></div>
            <div id="h3Btn"></div>
            <div id="bulletListBtn"></div>
            <div id="orderedListBtn"></div>
            <div id="blockquoteBtn"></div>
            <div id="imageInsertBtn"></div>
            <input type="file" id="imageInput" />
            <div id="syntaxStatus" class="hidden"></div>
            <div id="syntaxStatusText"></div>
        `;

        boldBtn = document.getElementById("boldBtn")!;
        inlineMathBtn = document.getElementById("inlineMathBtn")!;

        // Mock Tiptap Editor
        mockEditor = {
            chain: () => mockEditor,
            focus: () => mockEditor,
            toggleBold: () => mockEditor,
            insertContent: () => mockEditor,
            run: () => true,
            isActive: () => false,
            on: () => {}
        };

        state.editor = mockEditor;
    });

    test("should bind bold button", () => {
        const spy = { called: false };
        mockEditor.toggleBold = () => {
            spy.called = true;
            return mockEditor;
        };

        setupToolbar();
        boldBtn.click();
        expect(spy.called).toBe(true);
    });

    test("should bind math inline button with default latex", () => {
        let insertedContent: any = null;
        mockEditor.insertContent = (content: any) => {
            insertedContent = content;
            return mockEditor;
        };

        setupToolbar();
        inlineMathBtn.click();
        expect(insertedContent).toEqual({ type: 'mathInline', attrs: { latex: 'f(x)' } });
    });
});
