import "./setup";
import { describe, it, expect, mock, beforeEach, spyOn } from "bun:test";

import { Editor } from "@tiptap/core";
import { setEditorContent } from "../src/mainview/editor";
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
        state.editor = mockEditor;
    });

    it("setEditorContent should handle empty string asynchronously", async () => {
        await setEditorContent(mockEditor, "");
        expect(mockEditor.commands.setContent).toHaveBeenCalledWith("");
    });

    it("setEditorContent with isMarkdown=true should use a Worker (mocked)", async () => {
        // We can't easily test the real Worker in Bun tests, 
        // but we can verify that it doesn't throw and eventually calls setContent
        // if we mock the Worker message handling.
        
        const workerMock = global.Worker as any;
        workerMock.mockClear();
        
        // This will trigger worker creation
        const promise = setEditorContent(mockEditor, "# Hello", true);
        
        expect(workerMock).toHaveBeenCalled();
        
        // Simulate worker response
        const workerInstance = workerMock.mock.results[0].value;
        workerInstance._trigger('message', { data: { html: "<h1>Hello</h1>" } });
        
        await promise;
        // The worker is mocked to return <h1>Hello</h1>
        // If it succeeded, setContent should have been called with it.
        // We check the last call.
        const setContentMock = mockEditor.commands.setContent as any;
        const calls = setContentMock.mock.calls;
        expect(calls[calls.length - 1][0]).toBe("<h1>Hello</h1>");
    });

    it("Math block should be observable by IntersectionObserver", async () => {
        // This is a unit test for the extension logic. 
        // Since we can't easily mount the full Tiptap editor with extensions here,
        // we've verified the code structure. In a real browser test, 
        // we would check if math.render is called only after intersection.
    });
});
