import { BaseModal } from "./BaseModal";
import { electroview } from "../ipc";
import { t } from "../utils/i18n";

/**
 * Modal for "About" and License information.
 */
export class AboutModal extends BaseModal {
    private helpMenuBtn = document.getElementById('helpMenuBtn');
    private helpDropdown = document.getElementById('helpDropdown');
    private showLicenseBtn = document.getElementById('showLicenseBtn');
    private closeLicenseModalBtn = document.getElementById("closeLicenseModalBtn");
    private licenseList = document.getElementById("licenseList");

    constructor() {
        super("licenseModal");
    }

    init(): void {
        this.helpMenuBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            const isExpanded = this.helpMenuBtn!.getAttribute('aria-expanded') === 'true';
            this.helpMenuBtn!.setAttribute('aria-expanded', isExpanded ? 'false' : 'true');
            isExpanded ? this.helpDropdown?.classList.add('hidden') : this.helpDropdown?.classList.remove('hidden');
        });

        document.addEventListener('click', (e) => {
            if (this.helpDropdown && !this.helpDropdown.classList.contains('hidden')) {
                if (!(e.target as HTMLElement).closest('.dropdown')) {
                    this.helpMenuBtn?.setAttribute('aria-expanded', 'false');
                    this.helpDropdown.classList.add('hidden');
                }
            }
        });

        this.showLicenseBtn?.addEventListener('click', () => {
            this.helpMenuBtn?.setAttribute('aria-expanded', 'false');
            this.helpDropdown?.classList.add('hidden');
            this.show();
        });

        this.closeLicenseModalBtn?.addEventListener('click', () => this.hide());
    }

    protected async onShow(): Promise<void> {
        if (this.licenseList) {
            this.licenseList.innerHTML = `<div class="loading">${t("settings.help.licenseLoading")}</div>`;
            try {
                const licenses = await electroview.rpc?.request.getLicenses({});
                if (licenses && Array.isArray(licenses)) {
                    this.licenseList.innerHTML = licenses.map((lib: any) => `
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
                    this.licenseList.innerHTML = `<div class="error">${t("common.error")}</div>`;
                }
            } catch (err) {
                console.error("Failed to load licenses:", err);
                this.licenseList.innerHTML = `<div class="error">${t("common.error")}</div>`;
            }
        }
    }
}
