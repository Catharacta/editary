import { BaseModal } from "./BaseModal";
import { state } from "../state/workspace";
import { t, loadLocale, getLocale, updateUI } from "../utils/i18n";

/**
 * Modal for application settings.
 */
export class SettingsModal extends BaseModal {
    private settingsBtn = document.getElementById("settingsBtn");
    private closeSettingsModal = document.getElementById("closeSettingsModal");
    private saveSettingsBtn = document.getElementById("saveSettingsBtn");
    private themeInputs = document.querySelectorAll('input[name="appTheme"]') as NodeListOf<HTMLInputElement>;
    private settingsTabs = document.querySelectorAll('.settings-tab-btn');
    private settingsPanes = document.querySelectorAll('.settings-pane');
    private languageSelect = document.getElementById("languageSelect") as HTMLSelectElement;

    constructor() {
        super("settingsModal");
    }

    init(): void {
        this.settingsBtn?.addEventListener("click", () => {
            this.applyTheme(localStorage.getItem('editary-theme') || 'yellow');
            this.applyEditorSettings();
            this.switchSettingsTab('appearance');
            this.show();
        });

        const hide = () => this.hide();
        this.closeSettingsModal?.addEventListener("click", hide);
        this.saveSettingsBtn?.addEventListener("click", hide);

        this.settingsTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const tabId = tab.getAttribute('data-tab');
                if (tabId) this.switchSettingsTab(tabId);
            });
        });

        this.themeInputs.forEach(input => {
            input.addEventListener('change', () => {
                if (input.checked) this.applyTheme(input.value);
            });
        });

        const autoSaveToggle = document.getElementById("autoSaveToggle") as HTMLInputElement;
        const lineNumbersToggle = document.getElementById("lineNumbersToggle") as HTMLInputElement;

        autoSaveToggle?.addEventListener('change', () => {
            state.editorSettings.autoSave = autoSaveToggle.checked;
            localStorage.setItem('editary-settings', JSON.stringify(state.editorSettings));
        });

        lineNumbersToggle?.addEventListener('change', () => {
            state.editorSettings.showLineNumbers = lineNumbersToggle.checked;
            localStorage.setItem('editary-settings', JSON.stringify(state.editorSettings));
            this.updateEditorView();
        });

        this.languageSelect?.addEventListener('change', async () => {
            const newLocale = this.languageSelect.value;
            await loadLocale(newLocale);
            updateUI();
        });

        // Initialize state
        this.applyTheme(localStorage.getItem('editary-theme') || 'yellow');
        this.applyEditorSettings();
    }

    private applyTheme(themeName: string) {
        const themes = ['theme-yellow', 'theme-red', 'theme-blue', 'theme-green', 'theme-purple', 'theme-pink', 'theme-black'];
        document.body.classList.remove(...themes);
        if (themeName !== 'default') document.body.classList.add(`theme-${themeName}`);
        
        const radio = document.querySelector(`input[name="appTheme"][value="${themeName}"]`) as HTMLInputElement;
        if (radio) radio.checked = true;
        localStorage.setItem('editary-theme', themeName);
    }

    private applyEditorSettings() {
        const autoSaveToggle = document.getElementById("autoSaveToggle") as HTMLInputElement;
        const lineNumbersToggle = document.getElementById("lineNumbersToggle") as HTMLInputElement;

        const settings = JSON.parse(localStorage.getItem('editary-settings') || JSON.stringify(state.editorSettings));
        state.editorSettings = settings;

        if (autoSaveToggle) autoSaveToggle.checked = state.editorSettings.autoSave;
        if (lineNumbersToggle) lineNumbersToggle.checked = state.editorSettings.showLineNumbers;
        
        if (this.languageSelect) {
            this.languageSelect.value = getLocale();
        }
        
        this.updateEditorView();
    }

    private switchSettingsTab(tabId: string) {
        this.settingsTabs.forEach(tab => tab.classList.toggle('active', tab.getAttribute('data-tab') === tabId));
        this.settingsPanes.forEach(pane => pane.classList.toggle('active', pane.id === `pane-${tabId}`));
    }

    private updateEditorView() {
        const editor = document.getElementById("editor");
        if (editor) {
            const shouldShow = state.editorSettings.showLineNumbers && state.currentFilePath !== null;
            editor.classList.toggle("show-line-numbers", shouldShow);
        }
    }
}
