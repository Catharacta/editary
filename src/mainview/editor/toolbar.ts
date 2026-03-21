import { state } from "../state/workspace";
import { reparseContent } from "../editor";

export function setupToolbar() {
    const updateBtn = document.getElementById("updateContentBtn");
    const syntaxStatus = document.getElementById("syntaxStatus");
    const syntaxStatusText = document.getElementById("syntaxStatusText");
    const statusIconInfo = document.getElementById("statusIconInfo");
    const statusIconWarning = document.getElementById("statusIconWarning");

    updateBtn?.addEventListener("click", () => {
        if (state.editor) {
            const result = reparseContent(state.editor);
            showSyntaxStatus(result.message, result.success ? "info" : "warning");
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
