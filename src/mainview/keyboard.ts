import { KeyboardManager } from "./keyboard/KeyboardManager";

/**
 * Legacy wrapper for setupKeyboardShortcuts.
 * @deprecated Use KeyboardManager.init() instead.
 */
export function setupKeyboardShortcuts() {
    KeyboardManager.init();
}
