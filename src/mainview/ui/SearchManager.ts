import { IpcManager } from "../ipc/IpcManager";
import { state } from "../state/workspace";
import { EditorManager } from "../editor/EditorManager";
import { openFile } from "../workspace/file-ops";
import { SearchResult } from "../../shared/types";

/**
 * Manager for the Search UI component.
 */
export class SearchManager {
    private static elements = {
        searchInput: null as HTMLInputElement | null,
        resultsList: null as HTMLElement | null,
        resultsCount: null as HTMLElement | null,
        spinner: null as HTMLElement | null,
    };

    private static debounceTimer: any = null;

    /**
     * Initializes the search panel and binds events.
     */
    static init() {
        this.elements.searchInput = document.getElementById("workspaceSearchInput") as HTMLInputElement;
        this.elements.resultsList = document.getElementById("workspaceSearchResultsList");
        this.elements.resultsCount = document.getElementById("workspaceSearchResultsCount");
        this.elements.spinner = document.getElementById("workspaceSearchSpinner");

        this.elements.searchInput?.addEventListener("input", (e) => {
            const query = (e.target as HTMLInputElement).value;
            this.debouncedSearch(query);
        });

        // Click on background of list to focus input
        this.elements.resultsList?.addEventListener("click", (e) => {
            if (e.target === this.elements.resultsList) {
                this.elements.searchInput?.focus();
            }
        });
    }

    /**
     * Executes the search with a small delay for better performance.
     */
    private static debouncedSearch(query: string) {
        clearTimeout(this.debounceTimer);
        this.debounceTimer = setTimeout(() => this.performSearch(query), 300);
    }

    /**
     * Calls the RPC search and renders the results.
     */
    static async performSearch(query: string) {
        if (!query || query.length < 2) {
            this.clearResults();
            return;
        }

        if (!state.currentFolderPath) {
            this.elements.resultsList!.innerHTML = '<div class="empty-state-text">Open a workspace to search.</div>';
            return;
        }

        this.elements.spinner?.classList.remove("hidden");

        try {
            const results = await IpcManager.searchInFiles(query, state.currentFolderPath);
            state.searchResults = results;
            this.renderResults(results, query);
        } catch (e) {
            console.error("Search failed:", e);
            this.elements.resultsList!.innerHTML = '<div class="empty-state-text">Search failed.</div>';
        } finally {
            this.elements.spinner?.classList.add("hidden");
        }
    }

    /**
     * Clears the results panel.
     */
    static clearResults() {
        if (this.elements.resultsList) this.elements.resultsList.innerHTML = "";
        if (this.elements.resultsCount) this.elements.resultsCount.innerHTML = "";
        state.searchResults = [];
    }

    /**
     * Renders the search results in the sidebar.
     */
    private static renderResults(results: SearchResult[], query: string) {
        if (!this.elements.resultsList || !this.elements.resultsCount) return;

        const totalMatches = results.reduce((sum, res) => sum + res.matches.length, 0);
        this.elements.resultsCount.innerText = `${totalMatches} matches in ${results.length} files`;

        if (results.length === 0) {
            this.elements.resultsList.innerHTML = '<div class="empty-state-text">No results found.</div>';
            return;
        }

        this.elements.resultsList.innerHTML = "";
        
        results.forEach(result => {
            const resultItem = document.createElement("div");
            resultItem.className = "search-result-item";
            
            // File Header
            const fileHeader = document.createElement("div");
            fileHeader.className = "search-result-file";
            fileHeader.innerHTML = `
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
                    <polyline points="13 2 13 9 20 9"></polyline>
                </svg>
                <span>${result.fileName}</span>
            `;
            resultItem.appendChild(fileHeader);

            // Matches Container
            const matchesContainer = document.createElement("div");
            matchesContainer.className = "search-result-matches";

            result.matches.forEach(match => {
                const matchItem = document.createElement("div");
                matchItem.className = "search-match-item";
                
                // Highlight the query in the snippet
                const snippet = this.highlightQuery(match.text, query);
                matchItem.innerHTML = `<span class="line-number">${match.line}:</span> ${snippet}`;
                
                matchesContainer.appendChild(matchItem);
            });

            resultItem.appendChild(matchesContainer);

            // Link to File
            resultItem.addEventListener("click", () => {
                openFile(result.filePath);
                // Future: Highlight the exact position/line
            });

            this.elements.resultsList?.appendChild(resultItem);
        });
    }

    /**
     * Highlights the query term in a text snippet.
     */
    private static highlightQuery(text: string, query: string): string {
        const regex = new RegExp(`(${query})`, 'gi');
        return text.replace(regex, '<span class="highlight">$1</span>');
    }
}
