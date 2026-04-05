import { state } from "../state/workspace";

/**
 * Manager for the Activity Bar UI component.
 * Handles switching between different sidebar panels (Explorer, Search, etc.)
 */
export class ActivityBarManager {
    private static elements = {
        explorerTabBtn: null as HTMLElement | null,
        searchTabBtn: null as HTMLElement | null,
        explorerPanel: null as HTMLElement | null,
        searchPanel: null as HTMLElement | null,
    };

    /**
     * Initializes the activity bar and binds events.
     */
    static init() {
        this.elements.explorerTabBtn = document.getElementById("explorerTabBtn");
        this.elements.searchTabBtn = document.getElementById("searchTabBtn");
        this.elements.explorerPanel = document.getElementById("explorerPanel");
        this.elements.searchPanel = document.getElementById("workspaceSearchPanel");

        this.elements.explorerTabBtn?.addEventListener("click", () => this.switchTab('explorer'));
        this.elements.searchTabBtn?.addEventListener("click", () => this.switchTab('search'));

        // Restore initial state from workspace state if necessary
        this.switchTab(state.activeSidebarTab || 'explorer');
    }

    /**
     * Switches the active sidebar panel and highlights the corresponding button.
     */
    static switchTab(tab: 'explorer' | 'search') {
        state.activeSidebarTab = tab;

        // Update Buttons
        this.elements.explorerTabBtn?.classList.toggle("active", tab === 'explorer');
        this.elements.searchTabBtn?.classList.toggle("active", tab === 'search');

        // Update Panels
        this.elements.explorerPanel?.classList.toggle("hidden", tab !== 'explorer');
        this.elements.searchPanel?.classList.toggle("hidden", tab !== 'search');

        // Focus search input if switching to search
        if (tab === 'search') {
            const searchInput = document.getElementById("searchInput") as HTMLInputElement;
            searchInput?.focus();
        }
    }
}
