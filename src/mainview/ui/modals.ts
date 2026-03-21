import { state } from "../state/workspace";
import { electroview } from "../ipc";
import { getEditorHTML } from "../editor";

export function setupModals() {
    setupExportModal();
    setupSettingsModal();
    setupAboutAndHelp();
}

function setupExportModal() {
    const exportBtn = document.getElementById("exportBtn");
    const exportModal = document.getElementById("exportModal");
    const closeExportModal = document.getElementById("closeExportModal");
    const cancelExport = document.getElementById("cancelExport");
    const executeExport = document.getElementById("executeExport");
    const exportStyleGroup = document.getElementById("exportStyleGroup");

    exportBtn?.addEventListener("click", () => {
        if (!state.currentFilePath && (!state.editor || !state.editor.getText())) {
            alert("エクスポートする内容がありません。");
            return;
        }
        exportModal?.classList.remove("hidden");
    });

    const hideExportModal = () => exportModal?.classList.add("hidden");
    closeExportModal?.addEventListener("click", hideExportModal);
    cancelExport?.addEventListener("click", hideExportModal);

    document.querySelectorAll('input[name="exportFormat"]').forEach(input => {
        input.addEventListener('change', () => {
            exportStyleGroup?.classList.remove('hidden');
        });
    });

    executeExport?.addEventListener("click", async () => {
        const format = (document.querySelector('input[name="exportFormat"]:checked') as HTMLInputElement)?.value;
        const style = (document.querySelector('input[name="exportStyle"]:checked') as HTMLInputElement)?.value;
        
        hideExportModal();

        const html = state.editor ? getEditorHTML(state.editor) : "";
        const fileName = state.currentFilePath ? state.currentFilePath.split(/[/\\]/).pop()?.replace(/\\.md$/i, '') : "untitled";
        
        if (format === 'html') {
            const fullHtml = generateFullHtml(html, style);
            await performSaveExport(fileName + ".html", fullHtml);
        } else if (format === 'pdf') {
            document.body.classList.add(`export-${style}`);
            setTimeout(() => {
                window.print();
                document.body.classList.remove(`export-${style}`);
            }, 100);
        }
    });
}

async function performSaveExport(defaultName: string, content: string) {
    const defaultPath = state.currentFolderPath ? `${state.currentFolderPath}\\\\${defaultName}` : `C:\\\\Users\\\\${defaultName}`;
    
    try {
        const savePath = await electroview.rpc?.request.showSaveFileDialog({
            defaultPath,
            title: "エクスポート先の保存"
        });

        if (savePath) {
            const success = await electroview.rpc?.request.writeFile({
                filePath: savePath,
                content: content
            });
            if (success) {
                alert("エクスポートが完了しました。");
            } else {
                alert("ファイルの保存に失敗しました。");
            }
        }
    } catch (error) {
        console.error("Export failed:", error);
        alert("エクスポート中にエラーが発生しました。");
    }
}

function generateFullHtml(contentHtml: string, style: string): string {
    const isTheme = style === 'theme';
    const title = state.currentFilePath ? state.currentFilePath.split(/[/\\]/).pop() || "Document" : "Document";
    
    // ... [Styles remain the same as before] -> Simplified inline for brevity but preserving structure
    const themeStyles = `
        body { font-family: 'Inter', sans-serif; line-height: 1.7; color: #1a1a1a; max-width: 850px; margin: 0 auto; padding: 60px 40px; background: #fffdf7; }
        .ProseMirror { background: #ffffff; border: 4px solid #1a1a1a; box-shadow: 12px 12px 0px #1a1a1a; padding: 40px; }
        h1, h2, h3 { font-weight: 900; color: #1a1a1a; margin-top: 1.8em; margin-bottom: 0.8em; line-height: 1.2; }
        h1 { font-size: 2.5em; border-bottom: 6px solid #fbbf24; display: inline-block; padding-bottom: 0.1em; }
        h2 { font-size: 1.8em; border-bottom: 4px solid #1a1a1a; padding-bottom: 0.2em; }
        h3 { font-size: 1.4em; }
        p { margin-bottom: 1.2em; }
        a { color: #1a1a1a; text-decoration: none; border-bottom: 3px solid #fbbf24; font-weight: 700; }
        a:hover { background: #fbbf24; }
        pre { background: #1a1a1a; color: #fffdf7; padding: 20px; overflow-x: auto; border: 3px solid #1a1a1a; box-shadow: 6px 6px 0px #fbbf24; margin: 1.5em 0; }
        code { font-family: 'JetBrains Mono', monospace; background: #fbbf24; color: #1a1a1a; padding: 0.2em 0.4em; font-weight: 700; }
        pre code { background: transparent; color: inherit; padding: 0; font-weight: 400; }
        blockquote { border: 3px solid #1a1a1a; background: #fef3c7; margin: 2em 0; padding: 20px 30px; box-shadow: 6px 6px 0px #f97316; font-style: italic; border-left: 12px solid #f97316; }
        table { border-collapse: collapse; width: 100%; margin: 2em 0; border: 4px solid #1a1a1a; box-shadow: 8px 8px 0px #1a1a1a; }
        th, td { border: 2px solid #1a1a1a; padding: 12px 16px; text-align: left; }
        th { background: #fbbf24; font-weight: 900; text-transform: uppercase; font-size: 0.9em; letter-spacing: 0.05em; }
        tr:nth-child(even) { background: #fffdf7; }
        img { max-width: 100%; border: 4px solid #1a1a1a; box-shadow: 8px 8px 0px #1a1a1a; margin: 1.5em 0; }
        hr { border: none; border-top: 4px dashed #1a1a1a; margin: 3em 0; }
    `;

    const cleanStyles = `
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #24292f; max-width: 800px; margin: 40px auto; padding: 0 30px; background: #ffffff; }
        h1, h2, h3 { font-weight: 600; color: #1a1a1a; margin-top: 24px; margin-bottom: 16px; line-height: 1.25; }
        h1 { font-size: 2em; padding-bottom: 0.3em; border-bottom: 1px solid #d0d7de; }
        h2 { font-size: 1.5em; padding-bottom: 0.3em; border-bottom: 1px solid #d0d7de; }
        h3 { font-size: 1.25em; }
        p { margin-bottom: 16px; }
        a { color: #0969da; text-decoration: none; }
        a:hover { text-decoration: underline; }
        pre { background: #f6f8fa; padding: 16px; overflow-x: auto; border-radius: 6px; margin-bottom: 16px; border: 1px solid #d0d7de; }
        code { font-family: 'JetBrains Mono', monospace; background: rgba(175, 184, 193, 0.2); padding: 0.2em 0.4em; border-radius: 6px; font-size: 85%; }
        pre code { background: transparent; padding: 0; font-size: 100%; }
        blockquote { border-left: 0.25em solid #d0d7de; color: #57606a; padding: 0 1em; margin: 0 0 16px 0; }
        table { border-collapse: collapse; width: 100%; margin-bottom: 16px; }
        th, td { border: 1px solid #d0d7de; padding: 6px 13px; }
        th { background: #f6f8fa; font-weight: 600; }
        tr:nth-child(even) { background: #f6f8fa; }
        img { max-width: 100%; }
        hr { height: 0.25em; padding: 0; margin: 24px 0; background-color: #d0d7de; border: 0; }
    `;

    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
        ${isTheme ? themeStyles : cleanStyles}
    </style>
</head>
<body>
    <div class="ProseMirror">
        ${contentHtml}
    </div>
</body>
</html>`;
}

function setupSettingsModal() {
    const settingsBtn = document.getElementById("settingsBtn");
    const settingsModal = document.getElementById("settingsModal");
    const closeSettingsModal = document.getElementById("closeSettingsModal");
    const saveSettingsBtn = document.getElementById("saveSettingsBtn");
    const themeInputs = document.querySelectorAll('input[name="appTheme"]') as NodeListOf<HTMLInputElement>;
    const settingsTabs = document.querySelectorAll('.settings-tab-btn');
    const settingsPanes = document.querySelectorAll('.settings-pane');

    function applyTheme(themeName: string) {
        const themes = ['theme-yellow', 'theme-red', 'theme-blue', 'theme-green', 'theme-purple', 'theme-pink', 'theme-black'];
        document.body.classList.remove(...themes);
        if (themeName !== 'default') document.body.classList.add(`theme-${themeName}`);
        
        const radio = document.querySelector(`input[name="appTheme"][value="${themeName}"]`) as HTMLInputElement;
        if (radio) radio.checked = true;
        localStorage.setItem('editary-theme', themeName);
    }

    function switchSettingsTab(tabId: string) {
        settingsTabs.forEach(tab => tab.classList.toggle('active', tab.getAttribute('data-tab') === tabId));
        settingsPanes.forEach(pane => pane.classList.toggle('active', pane.id === `pane-${tabId}`));
    }

    settingsBtn?.addEventListener("click", () => {
        applyTheme(localStorage.getItem('editary-theme') || 'yellow');
        switchSettingsTab('appearance');
        settingsModal?.classList.remove("hidden");
    });

    const hideSettingsModal = () => settingsModal?.classList.add("hidden");
    closeSettingsModal?.addEventListener("click", hideSettingsModal);
    saveSettingsBtn?.addEventListener("click", hideSettingsModal);

    settingsTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const tabId = tab.getAttribute('data-tab');
            if (tabId) switchSettingsTab(tabId);
        });
    });

    themeInputs.forEach(input => {
        input.addEventListener('change', () => {
            if (input.checked) applyTheme(input.value);
        });
    });

    settingsModal?.addEventListener("click", (e) => {
        if (e.target === settingsModal) hideSettingsModal();
    });

    applyTheme(localStorage.getItem('editary-theme') || 'yellow');
}

function setupAboutAndHelp() {
    const helpMenuBtn = document.getElementById('helpMenuBtn');
    const helpDropdown = document.getElementById('helpDropdown');
    const showLicenseBtn = document.getElementById('showLicenseBtn');
    const licenseModal = document.getElementById("licenseModal");
    const closeLicenseModalBtn = document.getElementById("closeLicenseModalBtn");
    const licenseList = document.getElementById("licenseList");

    helpMenuBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        const isExpanded = helpMenuBtn.getAttribute('aria-expanded') === 'true';
        helpMenuBtn.setAttribute('aria-expanded', isExpanded ? 'false' : 'true');
        isExpanded ? helpDropdown?.classList.add('hidden') : helpDropdown?.classList.remove('hidden');
    });

    document.addEventListener('click', (e) => {
        if (helpDropdown && !helpDropdown.classList.contains('hidden')) {
            if (!(e.target as HTMLElement).closest('.dropdown')) {
                helpMenuBtn?.setAttribute('aria-expanded', 'false');
                helpDropdown.classList.add('hidden');
            }
        }
    });

    // Make it globally accessible for "About" button
    (window as any).openLicenseModal = async () => {
        if (licenseModal) {
            licenseModal.classList.remove("hidden");
            if (licenseList) {
                licenseList.innerHTML = '<div class="loading">読み込み中...</div>';
                try {
                    const licenses = await electroview.rpc?.request.getLicenses({});
                    if (licenses && Array.isArray(licenses)) {
                        licenseList.innerHTML = licenses.map((lib: any) => `
                            <div class="license-item">
                                <div class="license-header">
                                    <span class="license-name">${lib.name}</span>
                                    <span class="license-type">${lib.type}</span>
                                </div>
                                <div class="license-copyright">${lib.copyright || ''}</div>
                                <div class="license-text">${lib.text}</div>
                            </div>
                        `).join('');
                    } else {
                        licenseList.innerHTML = '<div class="error">ライセンス情報の取得に失敗しました。</div>';
                    }
                } catch (err) {
                    console.error("Failed to load licenses:", err);
                    licenseList.innerHTML = '<div class="error">エラーが発生しました。</div>';
                }
            }
        }
    };

    showLicenseBtn?.addEventListener('click', () => {
        helpMenuBtn?.setAttribute('aria-expanded', 'false');
        helpDropdown?.classList.add('hidden');
        (window as any).openLicenseModal();
    });

    closeLicenseModalBtn?.addEventListener('click', () => licenseModal?.classList.add('hidden'));
    licenseModal?.addEventListener('click', (e) => {
        if (e.target === licenseModal) licenseModal.classList.add('hidden');
    });
}
