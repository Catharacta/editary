import { electroview } from "../ipc";

export function setupWindowControls() {
    const minimizeBtn = document.getElementById("minimizeBtn");
    const maximizeBtn = document.getElementById("maximizeBtn");
    const closeBtn = document.getElementById("closeBtn");

    minimizeBtn?.addEventListener("click", () => {
        electroview.rpc?.send.minimizeWindow({});
    });

    maximizeBtn?.addEventListener("click", () => {
        electroview.rpc?.send.maximizeWindow({});
    });

    closeBtn?.addEventListener("click", () => {
        electroview.rpc?.send.closeWindow({});
    });
}
