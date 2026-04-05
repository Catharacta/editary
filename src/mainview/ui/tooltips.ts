import { TooltipManager } from "./TooltipManager";

/**
 * Legacy wrapper for setupTooltips.
 * @deprecated Use TooltipManager.init() instead.
 */
export function setupTooltips() {
    TooltipManager.init();
}
