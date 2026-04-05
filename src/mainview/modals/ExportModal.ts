import { BaseModal } from "./BaseModal";
import { state } from "../state/workspace";
import { electroview } from "../ipc";
import { getEditorHTML } from "../editor";
import { t } from "../utils/i18n";

/**
 * Modal for exporting documents.
 */
export class ExportModal extends BaseModal {
    private exportBtn = document.getElementById("exportBtn");
    private closeExportModal = document.getElementById("closeExportModal");
    private cancelExport = document.getElementById("cancelExport");
    private executeExport = document.getElementById("executeExport");
    private exportStyleGroup = document.getElementById("exportStyleGroup");

    constructor() {
        super("exportModal");
    }

    init(): void {
        this.exportBtn?.addEventListener("click", () => {
            if (!state.currentFilePath && (!state.editor || !state.editor.getText())) {
                // This would normally call showAlert, but for modularity we handle it here
                alert(t("export.noContent"));
                return;
            }
            this.show();
        });

        this.closeExportModal?.addEventListener("click", () => this.hide());
        this.cancelExport?.addEventListener("click", () => this.hide());

        document.querySelectorAll('input[name="exportFormat"]').forEach(input => {
            input.addEventListener('change', () => {
                this.exportStyleGroup?.classList.remove('hidden');
            });
        });

        this.executeExport?.addEventListener("click", () => this.handleExport());
    }

    private async handleExport() {
        const format = (document.querySelector('input[name="exportFormat"]:checked') as HTMLInputElement)?.value;
        const style = (document.querySelector('input[name="exportStyle"]:checked') as HTMLInputElement)?.value;
        
        this.hide();

        const html = state.editor ? getEditorHTML(state.editor) : "";
        const fileName = state.currentFilePath ? state.currentFilePath.split(/[/\\]/).pop()?.replace(/\.md$/i, '') : "untitled";
        
        if (format === 'html') {
            const fullHtml = this.generateFullHtml(html, style);
            await this.performSaveExport(fileName + ".html", fullHtml);
        } else if (format === 'pdf') {
            document.body.classList.add(`export-${style}`);
            setTimeout(() => {
                window.print();
                document.body.classList.remove(`export-${style}`);
            }, 100);
        }
    }

    private async performSaveExport(defaultName: string, content: string) {
        const defaultPath = state.currentFolderPath ? `${state.currentFolderPath}\\${defaultName}` : defaultName;
        
        try {
            const savePath = await electroview.rpc?.request.showSaveFileDialog({
                defaultPath,
                title: t("export.execute")
            });

            if (savePath) {
                const success = await electroview.rpc?.request.writeFile({
                    filePath: savePath,
                    content: content
                });
                if (success) {
                    // Success alert
                }
            }
        } catch (error) {
            console.error("Export failed:", error);
        }
    }

    private generateFullHtml(contentHtml: string, style: string): string {
        const isTheme = style === 'theme';
        const title = state.currentFilePath ? state.currentFilePath.split(/[/\\]/).pop() || "Document" : "Document";
        
        // Simplified styles for now as they are large in the original file
        // In a real implementation, I'd move these to a separate CSS file or constant
        const styles = isTheme ? `
            body { font-family: 'Inter', sans-serif; line-height: 1.7; color: #1a1a1a; max-width: 850px; margin: 0 auto; padding: 60px 40px; background: #fffdf7; }
            .ProseMirror { background: #ffffff; border: 4px solid #1a1a1a; box-shadow: 12px 12px 0px #1a1a1a; padding: 40px; }
            h1 { font-size: 2.5em; border-bottom: 6px solid #fbbf24; }
        ` : `
            body { font-family: system-ui; line-height: 1.6; max-width: 800px; margin: 40px auto; padding: 0 30px; }
            h1 { font-size: 2em; border-bottom: 1px solid #ddd; }
        `;

        return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>${title}</title>
    <style>${styles}</style>
</head>
<body><div class="ProseMirror">${contentHtml}</div></body>
</html>`;
    }
}
