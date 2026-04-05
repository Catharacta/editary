import { StatusBarManager } from "./StatusBarManager";

/**
 * Legacy wrapper for updateStatusBar.
 * @deprecated Use StatusBarManager.update() instead.
 */
export function updateStatusBar() {
    StatusBarManager.update();
}
