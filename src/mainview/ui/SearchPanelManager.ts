import { state } from "../state/workspace";

/**
 * Manager for the search and replace panel UI component.
 */
export class SearchPanelManager {
    private static elements = {
        panel: null as HTMLElement | null,
        searchInput: null as HTMLInputElement | null,
        replaceInput: null as HTMLInputElement | null,
        resultCount: null as HTMLElement | null,
        replaceRow: null as HTMLElement | null,
        toggleReplaceBtn: null as HTMLElement | null,
    };

    /**
     * Initializes the search panel and binds events.
     */
    static init() {
        this.elements.panel = document.getElementById("searchPanel");
        this.elements.searchInput = document.getElementById("searchInput") as HTMLInputElement;
        this.elements.replaceInput = document.getElementById("replaceInput") as HTMLInputElement;
        this.elements.resultCount = document.getElementById("searchResultCount");
        this.elements.replaceRow = document.getElementById("replaceRowContainer");
        this.elements.toggleReplaceBtn = document.getElementById("toggleReplaceBtn");

        const closeBtn = document.getElementById("searchCloseBtn");
        const nextBtn = document.getElementById("searchNextBtn");
        const prevBtn = document.getElementById("searchPrevBtn");
        const replaceBtn = document.getElementById("replaceBtn");
        const replaceAllBtn = document.getElementById("replaceAllBtn");

        // Event listeners
        this.elements.searchInput?.addEventListener("input", () => this.performSearch());
        
        this.elements.searchInput?.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                if (e.shiftKey) this.previous();
                else this.next();
            } else if (e.key === "Escape") {
                this.hide();
            }
        });

        this.elements.replaceInput?.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                this.replace();
            } else if (e.key === "Escape") {
                this.hide();
            }
        });

        closeBtn?.addEventListener("click", () => this.hide());
        nextBtn?.addEventListener("click", () => this.next());
        prevBtn?.addEventListener("click", () => this.previous());
        replaceBtn?.addEventListener("click", () => this.replace());
        replaceAllBtn?.addEventListener("click", () => this.replaceAll());

        this.elements.toggleReplaceBtn?.addEventListener("click", () => this.toggleReplaceMode());

        // Global shortcut registration fallback
        (window as any).toggleSearchPanel = (showReplace = false) => this.show(showReplace);
    }

    /**
     * Shows the search panel.
     */
    static show(showReplace = false) {
        if (!this.elements.panel || !state.editor) return;

        this.elements.panel.classList.remove("hidden");

        if (showReplace) {
            this.elements.replaceRow?.classList.add("show");
            this.elements.toggleReplaceBtn?.classList.add("expanded");
            this.elements.replaceInput?.focus();
        } else {
            this.elements.searchInput?.focus();
        }

        if (this.elements.searchInput?.value) {
            this.performSearch();
        }
    }

    /**
     * Hides the search panel and clears results.
     */
    static hide() {
        if (!this.elements.panel) return;
        this.elements.panel.classList.add("hidden");
        state.editor?.commands.setSearchTerm("");
        state.editor?.commands.focus();
    }

    /**
     * Executes the search operation in the editor.
     */
    private static performSearch() {
        const term = this.elements.searchInput?.value || "";
        if (state.editor) {
            state.editor.commands.setSearchTerm(term);
            this.updateCount();
        }
    }

    /**
     * Updates the search result count display.
     */
    static updateCount() {
        if (!state.editor || !this.elements.resultCount) return;
        
        const searchState = (state.editor.storage as any).searchAndReplace;
        if (searchState) {
            const total = searchState.results?.length || 0;
            const current = total === 0 ? 0 : searchState.resultIndex + 1;
            this.elements.resultCount.textContent = `${current}/${total}`;
        }
    }

    static next() {
        state.editor?.commands.nextSearchResult();
        this.updateCount();
    }

    static previous() {
        state.editor?.commands.previousSearchResult();
        this.updateCount();
    }

    static replace() {
        state.editor?.commands.replace();
        this.updateCount();
    }

    static replaceAll() {
        state.editor?.commands.replaceAll();
        this.updateCount();
    }

    private static toggleReplaceMode() {
        const isExpanded = this.elements.toggleReplaceBtn?.classList.contains("expanded");
        if (isExpanded) {
            this.elements.toggleReplaceBtn?.classList.remove("expanded");
            this.elements.replaceRow?.classList.remove("show");
        } else {
            this.elements.toggleReplaceBtn?.classList.add("expanded");
            this.elements.replaceRow?.classList.add("show");
            this.elements.replaceInput?.focus();
        }
    }
}
