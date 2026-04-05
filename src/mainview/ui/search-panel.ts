import { SearchPanelManager } from "./SearchPanelManager";

/**
 * Legacy wrapper for setupSearchPanel.
 * @deprecated Use SearchPanelManager.init() instead.
 */
export function setupSearchPanel() {
    SearchPanelManager.init();
}
