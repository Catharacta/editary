import { IpcManager } from "../ipc/IpcManager";
import { state } from "../state/workspace";
import { EditorManager } from "../editor/EditorManager";
import { openFile, renderOpenTabs } from "../workspace/file-ops";
import { SearchResult, SearchOptions } from "../../shared/types";

/**
 * Manager for the Search UI component.
 */
export class SearchManager {
    private static elements = {
        searchInput: null as HTMLInputElement | null,
        replaceInput: null as HTMLInputElement | null,
        replaceRow: null as HTMLElement | null,
        replaceToggle: null as HTMLElement | null,
        replaceAllBtn: null as HTMLElement | null,
        resultsList: null as HTMLElement | null,
        resultsCount: null as HTMLElement | null,
        spinner: null as HTMLElement | null,
        searchCaseBtn: null as HTMLElement | null,
        searchWordBtn: null as HTMLElement | null,
        searchRegexBtn: null as HTMLElement | null,
        searchDetailsToggle: null as HTMLElement | null,
        detailsRow: null as HTMLElement | null,
        includeInput: null as HTMLInputElement | null,
        excludeInput: null as HTMLInputElement | null,
    };

    private static options = {
        isCaseSensitive: false,
        isWholeWord: false,
        isRegex: false,
        includePattern: "",
        excludePattern: "",
    };

    private static debounceTimer: any = null;

    /**
     * Initializes the search panel and binds events.
     */
    static init() {
        this.elements.searchInput = document.getElementById("workspaceSearchInput") as HTMLInputElement;
        this.elements.replaceInput = document.getElementById("workspaceReplaceInput") as HTMLInputElement;
        this.elements.replaceRow = document.getElementById("workspaceReplaceRow");
        this.elements.replaceToggle = document.getElementById("workspaceReplaceToggle");
        this.elements.replaceAllBtn = document.getElementById("workspaceReplaceAllBtn");
        this.elements.resultsList = document.getElementById("workspaceSearchResultsList");
        this.elements.resultsCount = document.getElementById("workspaceSearchResultsCount");
        this.elements.spinner = document.getElementById("workspaceSearchSpinner");
        
        this.elements.searchCaseBtn = document.getElementById("searchCaseBtn");
        this.elements.searchWordBtn = document.getElementById("searchWordBtn");
        this.elements.searchRegexBtn = document.getElementById("searchRegexBtn");
        this.elements.searchDetailsToggle = document.getElementById("searchDetailsToggle");

        this.elements.detailsRow = document.getElementById("workspaceSearchDetailsRow");
        this.elements.includeInput = document.getElementById("workspaceSearchInclude") as HTMLInputElement;
        this.elements.excludeInput = document.getElementById("workspaceSearchExclude") as HTMLInputElement;

        this.elements.searchInput?.addEventListener("input", (e) => {
            this.debouncedSearch();
        });

        this.elements.includeInput?.addEventListener("input", () => this.debouncedSearch());
        this.elements.excludeInput?.addEventListener("input", () => this.debouncedSearch());

        // Keyboard shortcuts for inputs
        [this.elements.searchInput, this.elements.replaceInput, this.elements.includeInput, this.elements.excludeInput].forEach(input => {
            input?.addEventListener("keydown", (e: KeyboardEvent) => this.handleInputKeydown(e));
        });

        // Option toggles
        [
            { btn: this.elements.searchCaseBtn, key: 'isCaseSensitive' as const, char: 'c' },
            { btn: this.elements.searchWordBtn, key: 'isWholeWord' as const, char: 'w' },
            { btn: this.elements.searchRegexBtn, key: 'isRegex' as const, char: 'r' }
        ].forEach(({ btn, key }) => {
            btn?.addEventListener("click", () => this.toggleOption(key));
        });

        // Details toggle
        this.elements.searchDetailsToggle?.addEventListener("click", () => this.toggleDetails());

        this.elements.replaceToggle?.addEventListener("click", () => {
            this.toggleReplace();
        });

        this.elements.replaceAllBtn?.addEventListener("click", () => {
            this.performGlobalReplace();
        });

        // Results list navigation
        this.elements.resultsList?.addEventListener("keydown", (e: KeyboardEvent) => this.handleResultsKeydown(e));

        // Click on background of list to focus input
        this.elements.resultsList?.addEventListener("click", (e) => {
            if (e.target === this.elements.resultsList) {
                this.elements.searchInput?.focus();
            }
        });
    }

    /**
     * Handles keyboard shortcuts within search/replace inputs.
     */
    private static handleInputKeydown(e: KeyboardEvent) {
        // Alt + C/W/R/L toggles
        if (e.altKey) {
            switch (e.key.toLowerCase()) {
                case 'c': e.preventDefault(); this.toggleOption('isCaseSensitive'); break;
                case 'w': e.preventDefault(); this.toggleOption('isWholeWord'); break;
                case 'r': e.preventDefault(); this.toggleOption('isRegex'); break;
                case 'l': e.preventDefault(); this.toggleDetails(); break;
                case 'arrowdown': 
                    e.preventDefault(); 
                    if (e.target === this.elements.searchInput) {
                        this.elements.replaceInput?.focus();
                    }
                    break;
                case 'arrowup':
                    e.preventDefault();
                    if (e.target === this.elements.replaceInput) {
                        this.elements.searchInput?.focus();
                    }
                    break;
            }
        }

        if (e.key === "Enter") {
            e.preventDefault();
            if (e.ctrlKey && e.target === this.elements.replaceInput) {
                this.performGlobalReplace();
            } else {
                this.performSearch(); // Immediate search on Enter
            }
        }

        if (e.key === "ArrowDown" && !e.altKey) {
            // Move focus to results if at the end of inputs
            if (e.target === this.elements.excludeInput || (e.target === this.elements.searchInput && this.elements.detailsRow?.classList.contains("hidden"))) {
                const firstResult = this.elements.resultsList?.querySelector('.match-item') as HTMLElement;
                if (firstResult) {
                    e.preventDefault();
                    firstResult.focus();
                    firstResult.classList.add('selected');
                }
            }
        }
    }

    /**
     * Toggles a search option and refreshes results.
     */
    private static toggleOption(key: 'isCaseSensitive' | 'isWholeWord' | 'isRegex') {
        this.options[key] = !this.options[key];
        const btnId = key === 'isCaseSensitive' ? 'searchCaseBtn' : key === 'isWholeWord' ? 'searchWordBtn' : 'searchRegexBtn';
        const btn = document.getElementById(btnId);
        btn?.classList.toggle("active", this.options[key]);
        this.performSearch();
    }

    /**
     * Toggles the include/exclude details panel.
     */
    private static toggleDetails() {
        const isVisible = this.elements.detailsRow?.classList.toggle("hidden") === false;
        this.elements.searchDetailsToggle?.classList.toggle("active", isVisible);
    }

    /**
     * Toggles the replace row visibility.
     */
    private static toggleReplace() {
        const isVisible = this.elements.replaceRow?.classList.toggle("visible");
        this.elements.replaceToggle?.classList.toggle("active", isVisible);
    }

    /**
     * Handles keyboard navigation within the results list.
     */
    private static handleResultsKeydown(e: KeyboardEvent) {
        const current = document.activeElement as HTMLElement;
        if (!current || !current.classList.contains('match-item')) return;

        if (e.key === "ArrowDown") {
            e.preventDefault();
            const items = Array.from(this.elements.resultsList?.querySelectorAll('.match-item') || []) as HTMLElement[];
            const idx = items.indexOf(current);
            if (idx < items.length - 1) {
                current.classList.remove('selected');
                items[idx + 1].focus();
                items[idx + 1].classList.add('selected');
            }
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            const items = Array.from(this.elements.resultsList?.querySelectorAll('.match-item') || []) as HTMLElement[];
            const idx = items.indexOf(current);
            if (idx > 0) {
                current.classList.remove('selected');
                items[idx - 1].focus();
                items[idx - 1].classList.add('selected');
            } else {
                // Focus back to search input
                current.classList.remove('selected');
                this.elements.searchInput?.focus();
            }
        } else if (e.key === "Enter") {
            e.preventDefault();
            current.click(); // Trigger the jump to text logic
        }
    }

    /**
     * Executes the search with a small delay for better performance.
     */
    private static debouncedSearch() {
        clearTimeout(this.debounceTimer);
        this.debounceTimer = setTimeout(() => this.performSearch(), 300);
    }

    /**
     * Calls the RPC search and renders the results.
     */
    static async performSearch() {
        const query = this.elements.searchInput?.value || "";
        if (!query || query.length < 2) {
            this.clearResults();
            return;
        }

        if (!state.currentFolderPath) {
            this.elements.resultsList!.innerHTML = '<div class="empty-state-text">Open a workspace to search.</div>';
            return;
        }

        this.elements.spinner?.classList.remove("hidden");

        // Sync patterns from inputs
        this.options.includePattern = this.elements.includeInput?.value || "";
        this.options.excludePattern = this.elements.excludeInput?.value || "";

        try {
            const results = await IpcManager.searchInFiles(query, state.currentFolderPath, this.options);
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
                matchItem.className = "match-item";
                matchItem.tabIndex = 0;
                
                // Highlight the query in the snippet
                const snippet = this.highlightQuery(match.text, query);
                matchItem.innerHTML = `<span class="line-number">${match.line}:</span> ${snippet}`;
                
                // Jump to this specific match when clicked
                matchItem.addEventListener("click", (e) => {
                    e.stopPropagation(); // Avoid triggering parent folder/file click
                    this.elements.resultsList?.querySelectorAll('.match-item.selected').forEach(el => el.classList.remove('selected'));
                    matchItem.classList.add('selected');
                    openFile(result.filePath, { jumpToText: match.text });
                });
                
                matchItem.addEventListener("keydown", (e) => this.handleResultsKeydown(e));

                matchesContainer.appendChild(matchItem);
            });

            resultItem.appendChild(matchesContainer);

            // Clicking the file header or item (outside specific matches) opens the file
            resultItem.addEventListener("click", () => {
                // If there are matches, jump to the first one
                const firstMatch = result.matches[0]?.text;
                openFile(result.filePath, firstMatch ? { jumpToText: firstMatch } : undefined);
            });

            this.elements.resultsList?.appendChild(resultItem);
        });
    }

    /**
     * Highlights the query term in a text snippet.
     */
    private static highlightQuery(text: string, query: string): string {
        try {
            const regex = this.buildRegex(query, true);
            return text.replace(regex, '<span class="highlight">$1</span>');
        } catch (e) {
            // Fallback for invalid regex
            return text;
        }
    }

    /**
     * Helper to build a RegExp based on current options.
     */
    private static buildRegex(query: string, global: boolean = true): RegExp {
        let pattern = query;
        if (!this.options.isRegex) {
            pattern = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        }

        if (this.options.isWholeWord) {
            pattern = `\\b${pattern}\\b`;
        }

        let flags = (this.options.isCaseSensitive ? "" : "i");
        if (global) flags += "g";

        // If it's not a regex, ensure we catch the original text for highlighting
        if (!this.options.isRegex) {
            return new RegExp(`(${pattern})`, flags);
        } else {
            // For regex search, wrap the whole thing in a group if it doesn't have one 
            // for the highlight span replacement ($1)
            return new RegExp(`(${pattern})`, flags);
        }
    }

    /**
     * Executes the global replacement.
     */
    static async performGlobalReplace() {
        const query = this.elements.searchInput?.value;
        const replace = this.elements.replaceInput?.value;

        if (!query || replace === undefined || !state.searchResults.length) return;

        this.elements.spinner?.classList.remove("hidden");

        try {
            const closedFilePaths: string[] = [];
            const results = state.searchResults;

            // Build regex for replacement in open tabs
            const regex = this.buildRegex(query, true);

            for (const result of results) {
                const tab = state.openTabs.get(result.filePath);

                if (tab) {
                    // Update open tab
                    if (state.currentFilePath === result.filePath && state.editor) {
                        const html = state.editor.getHTML();
                        const newHtml = html.replace(regex, replace);
                        state.editor.commands.setContent(newHtml);
                    } else {
                        if (tab.cachedContent) {
                            tab.cachedContent = tab.cachedContent.replace(regex, replace);
                        }
                        tab.isDirty = true;
                    }
                } else {
                    closedFilePaths.push(result.filePath);
                }
            }

            // Batch update closed files on disk
            if (closedFilePaths.length > 0) {
                await IpcManager.replaceAllInFiles(query, replace, closedFilePaths, this.options);
            }

            // Refresh UI
            renderOpenTabs();
            // Re-perform search to update results list
            await this.performSearch();
            
        } catch (e) {
            console.error("Global replace failed:", e);
        } finally {
            this.elements.spinner?.classList.add("hidden");
        }
    }
}
