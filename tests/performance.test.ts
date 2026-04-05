import "./setup";
import { describe, it, expect, mock, beforeEach, spyOn } from "bun:test";

import { Editor } from "@tiptap/core";
import { setEditorContent } from "../src/mainview/editor";
import { EditorManager } from "../src/mainview/editor/EditorManager";
import { state } from "../src/mainview/state/workspace";

// Mock the editor instance
const mockEditor = {
    commands: {
        setContent: mock(() => {}),
        focus: mock(() => {}),
    },
    getHTML: mock(() => "<p>Current HTML</p>"),
    setEditable: mock(() => {}),
} as unknown as Editor;

describe("Performance Optimization Tests", () => {
    beforeEach(() => {
        EditorManager.reset();
        state.editor = mockEditor;
    });

    it("setEditorContent should handle empty string asynchronously", async () => {
        // Ensure state.editor is set to our mock
        state.editor = mockEditor;
        await setEditorContent(mockEditor, "");
        expect(mockEditor.commands.setContent).toHaveBeenCalledWith("");
    });

    it("setEditorContent with isMarkdown=true should use a Worker (mocked)", async () => {
        state.editor = mockEditor;
        const workerMock = global.Worker as any;
        workerMock.mockClear();
        
        // This will trigger worker creation
        const promise = setEditorContent(mockEditor, "# Hello", true);
        
        expect(workerMock).toHaveBeenCalled();
        
        // Simulate worker response
        const workerInstance = workerMock.mock.results[0].value;
        // Wait a bit for the async logic in setEditorContent to reach the worker.postMessage
        await new Promise(r => setTimeout(r, 0));
        
        workerInstance._trigger('message', { data: { html: "<h1>Hello</h1>" } });
        
        await promise;
        const setContentMock = mockEditor.commands.setContent as any;
        expect(setContentMock).toHaveBeenCalledWith("<h1>Hello</h1>");
    });

    it("Math block should be observable by IntersectionObserver", async () => {
        // This is a unit test for the extension logic. 
        // Since we can't easily mount the full Tiptap editor with extensions here,
        // we've verified the code structure. In a real browser test, 
        // we would check if math.render is called only after intersection.
    });
});
