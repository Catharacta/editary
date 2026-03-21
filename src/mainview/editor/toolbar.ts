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
