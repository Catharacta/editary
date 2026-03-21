/**
 * サイドバーのレイアウト（並び替えとリサイズ）を制御するモジュール
 */

export function initSidebarLayout() {
    const sidebar = document.getElementById("sidebar");
    if (!sidebar) return;

    setupDragging(sidebar);
    setupResizing(sidebar);
}

/**
 * セクションのドラッグ＆ドロップ（並び替え）を設定
 */
function setupDragging(sidebar: HTMLElement) {
    const sections = sidebar.querySelectorAll(".sidebar-section");

    sections.forEach(section => {
        const header = section.querySelector(".section-header") as HTMLElement;
        if (!header) return;

        // セクション全体ではなくヘッダーのみをドラッグ可能にする
        header.setAttribute("draggable", "true");

        header.addEventListener("dragstart", (e: any) => {
            e.dataTransfer.setData("text/plain", section.id);
            section.classList.add("dragging");
            e.dataTransfer.effectAllowed = "move";
        });

        header.addEventListener("dragend", () => {
            section.classList.remove("dragging");
            sidebar.querySelectorAll(".sidebar-section").forEach(s => s.classList.remove("drag-over"));
        });

        // セクション自体は dragover と drop をリッスンして受け皿になる
        section.addEventListener("dragover", (e: any) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
            section.classList.add("drag-over");
        });

        section.addEventListener("dragleave", () => {
            section.classList.remove("drag-over");
        });

        section.addEventListener("drop", (e: any) => {
            e.preventDefault();
            const draggedId = e.dataTransfer.getData("text/plain");
            const draggedElement = document.getElementById(draggedId);
            
            if (draggedElement && draggedElement !== section) {
                const rect = section.getBoundingClientRect();
                const midY = rect.top + rect.height / 2;
                
                if (e.clientY < midY) {
                    sidebar.insertBefore(draggedElement, section);
                } else {
                    sidebar.insertBefore(draggedElement, section.nextSibling);
                }
                
                refreshResizeHandles(sidebar);
            }
            section.classList.remove("drag-over");
        });
    });
}

/**
 * セクションのリサイズ（高さ変更）を設定
 */
function setupResizing(sidebar: HTMLElement) {
    refreshResizeHandles(sidebar);
}

function refreshResizeHandles(sidebar: HTMLElement) {
    // 既存のハンドルを削除
    sidebar.querySelectorAll(".resize-handle").forEach(h => h.remove());

    const sections = Array.from(sidebar.querySelectorAll(".sidebar-section:not(.hidden)")) as HTMLElement[];
    
    // セクション間にハンドルを挿入
    for (let i = 0; i < sections.length - 1; i++) {
        const handle = document.createElement("div");
        handle.className = "resize-handle";
        sidebar.insertBefore(handle, sections[i].nextSibling);

        let isResizing = false;

        handle.addEventListener("mousedown", (e) => {
            isResizing = true;
            document.body.style.cursor = "ns-resize";
            handle.classList.add("active");
            
            const prevSection = sections[i];
            const nextSection = sections[i+1];
            const initialY = e.clientY;
            const initialPrevHeight = prevSection.offsetHeight;
            const initialNextHeight = nextSection.offsetHeight;

            const onMouseMove = (moveEvent: MouseEvent) => {
                if (!isResizing) return;
                
                const deltaY = moveEvent.clientY - initialY;
                
                // flex-basis をピクセルに固定してリサイズを実現
                // ただし、一番上のセクション以外という条件がある場合は調整が必要
                // ここでは一般的なリサイズを実装
                
                const newPrevHeight = initialPrevHeight + deltaY;
                const newNextHeight = initialNextHeight - deltaY;

                if (newPrevHeight > 30 && newNextHeight > 30) {
                    prevSection.style.flexBasis = `${newPrevHeight}px`;
                    prevSection.style.flexGrow = "0";
                    nextSection.style.flexBasis = `${newNextHeight}px`;
                    nextSection.style.flexGrow = "0";
                }
            };

            const onMouseUp = () => {
                isResizing = false;
                document.body.style.cursor = "";
                handle.classList.remove("active");
                window.removeEventListener("mousemove", onMouseMove);
                window.removeEventListener("mouseup", onMouseUp);
            };

            window.addEventListener("mousemove", onMouseMove);
            window.addEventListener("mouseup", onMouseUp);
        });
    }
}
