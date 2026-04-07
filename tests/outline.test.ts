import { expect, test, describe, beforeEach, mock } from "bun:test";
import "./setup";
import { OutlineManager } from "../src/mainview/ui/OutlineManager";
import { setTranslationsForTest } from "../src/mainview/utils/i18n";

describe("OutlineManager", () => {
    beforeEach(() => {
        // Prepare DOM
        document.body.innerHTML = `
            <div id="outlineSection">
                <div class="section-header">Outline</div>
                <div id="outlineList"></div>
                <button id="refreshOutlineBtn"></button>
            </div>
        `;
        
        // Mock translations
        setTranslationsForTest({
            outline: {
                emptyHeading: "Empty Heading Translated"
            },
            sidebar: {
                noHeadings: "No Headings Translated"
            }
        });
        
        OutlineManager.init();
    });

    test("should render headings correctly including empty ones", () => {
        const mockEditor = {
            state: {
                doc: {
                    descendants: (cb: any) => {
                        // Normal heading
                        cb({ 
                            type: { name: "heading" }, 
                            attrs: { level: 1 }, 
                            textContent: "Heading 1" 
                        }, 0);
                        
                        // Empty heading (this is what failed)
                        cb({ 
                            type: { name: "heading" }, 
                            attrs: { level: 2 }, 
                            textContent: "" 
                        }, 10);
                        
                        return false; // Stop recursion for this mock
                    }
                }
            },
            commands: {
                focus: mock(() => {}),
                setTextSelection: mock(() => {}),
                scrollIntoView: mock(() => {}),
            },
            view: {
                nodeDOM: mock(() => document.createElement("div"))
            }
        } as any;

        OutlineManager.render(mockEditor);

        const outlineList = document.getElementById("outlineList");
        const items = outlineList?.querySelectorAll(".outline-item");
        
        expect(items?.length).toBe(2);
        
        // Check normal heading
        expect(items?.[0].textContent).toBe("Heading 1");
        expect(items?.[0].getAttribute("data-level")).toBe("1");
        
        // Check empty heading translation (THE FIX VERIFICATION)
        expect(items?.[1].textContent).toBe("Empty Heading Translated");
        expect(items?.[1].getAttribute("data-level")).toBe("2");
    });

    test("should show no headings message when doc is empty", () => {
        const mockEditor = {
            state: {
                doc: {
                    descendants: () => {}
                }
            }
        } as any;

        OutlineManager.render(mockEditor);
        
        const emptyMsg = document.querySelector(".outline-empty");
        expect(emptyMsg?.textContent).toBe("No Headings Translated");
    });

    test("should handle click events on outline items", () => {
        const focusMock = mock(() => {});
        const selectionMock = mock(() => {});
        
        const mockEditor = {
            state: {
                doc: {
                    descendants: (cb: any) => {
                        cb({ type: { name: "heading" }, attrs: { level: 1 }, textContent: "H1" }, 100);
                    }
                }
            },
            commands: {
                focus: focusMock,
                setTextSelection: selectionMock,
                scrollIntoView: mock(() => {}),
            },
            view: {
                nodeDOM: mock(() => document.createElement("div"))
            }
        } as any;

        OutlineManager.render(mockEditor);
        
        const item = document.querySelector(".outline-item") as HTMLElement;
        item.click();
        
        expect(focusMock).toHaveBeenCalled();
        expect(selectionMock).toHaveBeenCalledWith(100);
        expect(item.classList.contains("outline-item--active")).toBe(true);
    });
});
