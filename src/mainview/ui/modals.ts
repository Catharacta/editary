import { ModalsManager } from "./ModalsManager";

/**
 * Legacy wrapper for updateEditorView.
 * @deprecated Use ModalsManager.updateEditorView() instead.
 */
export function updateEditorView() {
    ModalsManager.updateEditorView();
}

/**
 * Legacy wrapper for setupModals.
 * @deprecated Use ModalsManager.init() instead.
 */
export function setupModals() {
    ModalsManager.init();
}

/**
 * Legacy wrapper for showUnsavedChangesModal.
 * @deprecated Use ModalsManager.showUnsavedChanges() instead.
 */
export function showUnsavedChangesModal(fileName: string) {
    return ModalsManager.showUnsavedChanges(fileName);
}

/**
 * Legacy wrapper for showAlert.
 * @deprecated Use ModalsManager.showAlert() instead.
 */
export function showAlert(title: string, message: string) {
    return ModalsManager.showAlert(title, message);
}

/**
 * Legacy wrapper for showConfirm.
 * @deprecated Use ModalsManager.showConfirm() instead.
 */
export function showConfirm(title: string, message: string) {
    return ModalsManager.showConfirm(title, message);
}
