import { WindowControlsManager } from "./WindowControlsManager";

/**
 * Legacy wrapper for setupWindowControls.
 * @deprecated Use WindowControlsManager.init() instead.
 */
export function setupWindowControls() {
    WindowControlsManager.init();
}
