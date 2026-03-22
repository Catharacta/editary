import { state } from "../state/workspace";

export interface ContextMenuItem {
    label: string;
    action: () => void;
    danger?: boolean;
}

export function showContextMenu(x: number, y: number, items: ContextMenuItem[]) {
    // Remove any existing menus
    hideContextMenu();

    const menu = document.createElement("div");
    menu.id = "contextMenu";
    menu.className = "context-menu";
    
    // Position menu
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;

    items.forEach(item => {
        const menuItem = document.createElement("div");
        menuItem.className = `context-menu-item ${item.danger ? 'context-menu-item--danger' : ''}`;
        menuItem.textContent = item.label;
        menuItem.addEventListener("click", (e) => {
            e.stopPropagation();
            item.action();
            hideContextMenu();
        });
        menu.appendChild(menuItem);
    });

    document.body.appendChild(menu);

    // Close menu on click outside
    const closeMenu = (e: MouseEvent) => {
        if (!menu.contains(e.target as Node)) {
            hideContextMenu();
            document.removeEventListener("mousedown", closeMenu);
        }
    };
    
    // Use timeout to avoid immediate closing from the same click event
    setTimeout(() => {
        document.addEventListener("mousedown", closeMenu);
    }, 10);
}

export function hideContextMenu() {
    const existing = document.getElementById("contextMenu");
    if (existing) {
        existing.remove();
    }
}
