import { state } from "../state/workspace";

export function setupSearchPanel() {
    const searchPanel = document.getElementById("searchPanel");
    const searchInput = document.getElementById("searchInput") as HTMLInputElement;
    const replaceInput = document.getElementById("replaceInput") as HTMLInputElement;
    const searchResultCount = document.getElementById("searchResultCount");
    const searchPrevBtn = document.getElementById("searchPrevBtn");
    const searchNextBtn = document.getElementById("searchNextBtn");
    const searchCloseBtn = document.getElementById("searchCloseBtn");
    const replaceRowContainer = document.getElementById("replaceRowContainer");
    const toggleReplaceBtn = document.getElementById("toggleReplaceBtn");
    const replaceBtn = document.getElementById("replaceBtn");
    const replaceAllBtn = document.getElementById("replaceAllBtn");

    function closeSearchPanel() {
        if (!searchPanel) return;
        searchPanel.classList.add("hidden");
        // Clear search in editor
        if (state.editor) state.editor.commands.setSearchTerm("");
    }

    function performSearch() {
        const term = searchInput?.value || "";
        if (state.editor) {
            if (term) {
                state.editor.commands.setSearchTerm(term);
                updateSearchCount();
            } else {
                state.editor.commands.setSearchTerm("");
                if (searchResultCount) searchResultCount.textContent = "0/0";
            }
        }
    }

    function updateSearchCount() {
        if (!state.editor) return;
        const searchState = (state.editor.storage as any).searchAndReplace;
        if (searchState && searchResultCount) {
            const total = searchState.results?.length || 0;
            const current = total === 0 ? 0 : searchState.resultIndex + 1;
            searchResultCount.textContent = `${current}/${total}`;
        }
    }

    // Exported for keyboard shortcuts
    (window as any).toggleSearchPanel = function(showReplace = false) {
        if (!searchPanel || !state.editor) return;
        
        if (searchPanel.classList.contains("hidden")) {
            searchPanel.classList.remove("hidden");
        }
        
        if (showReplace) {
            replaceRowContainer?.classList.add("show");
            toggleReplaceBtn?.classList.add("expanded");
            replaceInput?.focus();
        } else {
            searchInput?.focus();
        }
        
        if (searchInput?.value) {
            performSearch();
        }
    };

    searchInput?.addEventListener("input", performSearch);
    searchInput?.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && state.editor) {
            if (e.shiftKey) {
                state.editor.commands.previousSearchResult();
            } else {
                state.editor.commands.nextSearchResult();
            }
            updateSearchCount();
        } else if (e.key === "Escape") {
            closeSearchPanel();
            state.editor?.commands.focus();
        }
    });

    replaceInput?.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && state.editor) {
            state.editor.commands.replace();
            updateSearchCount();
        } else if (e.key === "Escape") {
            closeSearchPanel();
            state.editor?.commands.focus();
        }
    });

    searchCloseBtn?.addEventListener("click", closeSearchPanel);

    searchNextBtn?.addEventListener("click", () => {
        state.editor?.commands.nextSearchResult();
        updateSearchCount();
    });

    searchPrevBtn?.addEventListener("click", () => {
        state.editor?.commands.previousSearchResult();
        updateSearchCount();
    });

    toggleReplaceBtn?.addEventListener("click", () => {
        const isExpanded = toggleReplaceBtn.classList.contains("expanded");
        if (isExpanded) {
            toggleReplaceBtn.classList.remove("expanded");
            replaceRowContainer?.classList.remove("show");
        } else {
            toggleReplaceBtn.classList.add("expanded");
            replaceRowContainer?.classList.add("show");
            replaceInput?.focus();
        }
    });

    replaceBtn?.addEventListener("click", () => {
        state.editor?.commands.replace();
        updateSearchCount();
    });

    replaceAllBtn?.addEventListener("click", () => {
        state.editor?.commands.replaceAll();
        updateSearchCount();
    });
}
