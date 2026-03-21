import { state } from "../state/workspace";

export function setupTablePicker() {
    const tableInsertBtn = document.getElementById("tableInsertBtn");
    const tableGridPicker = document.getElementById("tableGridPicker");
    const tableGridInfo = document.getElementById("tableGridInfo");
    const tableGridContainer = document.getElementById("tableGridContainer");

    function closeTableGridPicker() {
        tableInsertBtn?.setAttribute("aria-expanded", "false");
        tableGridPicker?.classList.add("hidden");
    }

    function highlightGrid(rows: number, cols: number) {
        if (tableGridInfo) {
            tableGridInfo.textContent = `${rows} x ${cols}`;
        }
        
        if (tableGridContainer) {
            const cells = tableGridContainer.querySelectorAll('.table-grid-cell');
            cells.forEach(cell => {
                const r = parseInt((cell as HTMLElement).dataset.row || "1", 10);
                const c = parseInt((cell as HTMLElement).dataset.col || "1", 10);
                if (r <= rows && c <= cols) {
                    cell.classList.add('selected');
                } else {
                    cell.classList.remove('selected');
                }
            });
        }
    }

    if (tableGridContainer) {
        for (let row = 1; row <= 10; row++) {
            for (let col = 1; col <= 10; col++) {
                const cell = document.createElement("div");
                cell.className = "table-grid-cell";
                cell.dataset.row = row.toString();
                cell.dataset.col = col.toString();
                
                cell.addEventListener("mouseenter", () => {
                    highlightGrid(row, col);
                });
                
                cell.addEventListener("click", () => {
                    if (state.editor) {
                        state.editor.chain().focus().insertTable({ rows: row, cols: col, withHeaderRow: true }).run();
                    }
                    closeTableGridPicker();
                });
                
                tableGridContainer.appendChild(cell);
            }
        }
    }

    tableInsertBtn?.addEventListener("click", (e) => {
        e.stopPropagation();
        const isExpanded = tableInsertBtn.getAttribute("aria-expanded") === "true";
        
        if (isExpanded) {
            closeTableGridPicker();
        } else {
            tableInsertBtn.setAttribute("aria-expanded", "true");
            tableGridPicker?.classList.remove("hidden");
            highlightGrid(3, 3);
        }
    });

    document.getElementById("tb-addRowBefore")?.addEventListener("click", () => state.editor?.chain().focus().addRowBefore().run());
    document.getElementById("tb-addRowAfter")?.addEventListener("click", () => state.editor?.chain().focus().addRowAfter().run());
    document.getElementById("tb-deleteRow")?.addEventListener("click", () => state.editor?.chain().focus().deleteRow().run());
    document.getElementById("tb-addColumnBefore")?.addEventListener("click", () => state.editor?.chain().focus().addColumnBefore().run());
    document.getElementById("tb-addColumnAfter")?.addEventListener("click", () => state.editor?.chain().focus().addColumnAfter().run());
    document.getElementById("tb-deleteColumn")?.addEventListener("click", () => state.editor?.chain().focus().deleteColumn().run());
    document.getElementById("tb-mergeCells")?.addEventListener("click", () => state.editor?.chain().focus().mergeCells().run());
    document.getElementById("tb-deleteTable")?.addEventListener("click", () => state.editor?.chain().focus().deleteTable().run());
    document.getElementById("tb-alignLeft")?.addEventListener("click", () => state.editor?.chain().focus().setTextAlign("left").run());
    document.getElementById("tb-alignCenter")?.addEventListener("click", () => state.editor?.chain().focus().setTextAlign("center").run());
    document.getElementById("tb-alignRight")?.addEventListener("click", () => state.editor?.chain().focus().setTextAlign("right").run());

    document.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        if (tableGridPicker && !tableGridPicker.classList.contains("hidden")) {
            if (!target.closest(".toolbar-dropdown")) {
                closeTableGridPicker();
            }
        }
    });
}
