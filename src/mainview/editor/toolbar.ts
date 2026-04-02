import { state } from "../state/workspace";
import { reparseContent, handleImageInsert } from "../editor";

export function setupToolbar() {
    const updateBtn = document.getElementById("updateContentBtn");
    const syntaxStatus = document.getElementById("syntaxStatus");
    const syntaxStatusText = document.getElementById("syntaxStatusText");
    const statusIconInfo = document.getElementById("statusIconInfo");
    const statusIconWarning = document.getElementById("statusIconWarning");

    updateBtn?.addEventListener("click", async () => {
        if (state.editor) {
            const result = await reparseContent(state.editor);
            showSyntaxStatus(result.message, result.success ? "info" : "warning");
        }
    });

    const imageInsertBtn = document.getElementById("imageInsertBtn");
    const imageInput = document.getElementById("imageInput") as HTMLInputElement;

    imageInsertBtn?.addEventListener("click", () => {
        imageInput?.click();
    });

    imageInput?.addEventListener("change", (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file && state.editor) {
            handleImageInsert(state.editor, file);
            // Clear input so the same file can be selected again if needed
            imageInput.value = "";
        }
    });

    function setupFormattingButtons() {
        if (!state.editor) return;

        const editor = state.editor;

        const bindBtn = (id: string, action: () => void) => {
            const btn = document.getElementById(id);
            btn?.addEventListener("click", () => {
                action();
            });
        };

        // Bold, Italic, Code
        bindBtn("boldBtn", () => editor.chain().focus().toggleBold().run());
        bindBtn("italicBtn", () => editor.chain().focus().toggleItalic().run());
        bindBtn("codeInlineBtn", () => editor.chain().focus().toggleCode().run());

        // Headings
        bindBtn("h1Btn", () => editor.chain().focus().toggleHeading({ level: 1 }).run());
        bindBtn("h2Btn", () => editor.chain().focus().toggleHeading({ level: 2 }).run());
        bindBtn("h3Btn", () => editor.chain().focus().toggleHeading({ level: 3 }).run());

        // Lists
        bindBtn("bulletListBtn", () => editor.chain().focus().toggleBulletList().run());
        bindBtn("orderedListBtn", () => editor.chain().focus().toggleOrderedList().run());

        // Blockquote
        bindBtn("blockquoteBtn", () => editor.chain().focus().toggleBlockquote().run());

        // Math
        bindBtn("inlineMathBtn", () => editor.chain().focus().insertContent({ type: 'mathInline', attrs: { latex: 'f(x)' } }).run());
        bindBtn("mathBlockBtn", () => editor.chain().focus().insertContent({ type: 'mathBlock' }).run());

        // Update active states
        editor.on("transaction", () => {
            updateActiveStates(editor);
        });
    }

    function updateActiveStates(editor: any) {
        const checkActive = (id: string, name: string, attributes?: any) => {
            const btn = document.getElementById(id);
            if (btn) {
                const isActive = editor.isActive(name, attributes);
                btn.classList.toggle("is-active", isActive);
            }
        };

        checkActive("boldBtn", "bold");
        checkActive("italicBtn", "italic");
        checkActive("codeInlineBtn", "code");
        checkActive("h1Btn", "heading", { level: 1 });
        checkActive("h2Btn", "heading", { level: 2 });
        checkActive("h3Btn", "heading", { level: 3 });
        checkActive("bulletListBtn", "bulletList");
        checkActive("orderedListBtn", "orderedList");
        checkActive("blockquoteBtn", "blockquote");
        checkActive("inlineMathBtn", "mathInline");
        checkActive("mathBlockBtn", "mathBlock");
    }

    // Initialize formatting buttons if editor is already available, 
    // or wait for it to be set up.
    if (state.editor) {
        setupFormattingButtons();
    } else {
        // Simple polling/retry if needed, but setupEditorInstance 
        // usually calls setupToolbar after editor creation.
    }

    function showSyntaxStatus(message: string, type: "info" | "warning") {
        if (!syntaxStatus || !syntaxStatusText) return;

        syntaxStatusText.textContent = message;
        syntaxStatus.className = `syntax-status ${type === "warning" ? "syntax-status--warning" : ""}`;
        
        statusIconInfo?.classList.toggle("hidden", type !== "info");
        statusIconWarning?.classList.toggle("hidden", type !== "warning");
        
        syntaxStatus.classList.remove("hidden");

        setTimeout(() => {
            syntaxStatus.classList.add("hidden");
        }, 3000);
    }
}
