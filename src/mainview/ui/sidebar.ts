import { SidebarManager } from "./SidebarManager";

/**
 * Legacy wrapper for setupSidebar.
 * @deprecated Use SidebarManager.init() instead.
 */
export function setupSidebar() {
    SidebarManager.init();
}

/**
 * Legacy wrapper for openFolder.
 * @deprecated Use SidebarManager.openFolder() instead.
 */
export async function openFolder() {
    await SidebarManager.openFolder();
}

/**
 * Legacy wrapper for updateSidebarVisibility.
 * @deprecated Use SidebarManager.updateVisibility() instead.
 */
export function updateSidebarVisibility() {
    SidebarManager.updateVisibility();
}
