import React, { useState } from 'react';
import { useAppStore } from '../store';
import { searchFiles, replaceFiles, SearchResult, ReplaceResult } from '../api';
import './SearchView.css';
import { ChevronRight, ArrowRight } from 'lucide-react'; // Added ArrowRight

const SearchView: React.FC = () => {
    const {
        projectRoot,
        tabs,
        addTab,
        setCursorPos,
        searchExcludes,
        searchIncludes,
        searchMaxFileSize,
        searchCaseSensitive,
        searchWholeWord,
        searchRegex,
        setSearchExcludes,
        setSearchIncludes,
        setSearchCaseSensitive,
        setSearchWholeWord,
        setSearchRegex,
        // Replace State
        replaceQuery,
        isReplaceMode,
        setReplaceQuery,
        setIsReplaceMode
    } = useAppStore();

    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [replaceResults, setReplaceResults] = useState<ReplaceResult[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showDetails, setShowDetails] = useState(false);

    // Collect open file paths (for searching files not in project)
    const getOpenFilePaths = (): string[] => {
        return tabs
            .filter(t => t.type === 'editor' && t.path)
            .map(t => t.path as string);
    };

    // Helper to clear results when needed
    const clearResults = () => {
        setResults([]);
        setReplaceResults([]);
        setError(null);
    };

    const handleSearch = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!query) return;

        const openFilePaths = getOpenFilePaths();
        // Need either a project or open files to search
        if (!projectRoot && openFilePaths.length === 0) return;

        setIsSearching(true);
        clearResults();

        try {
            const res = await searchFiles(
                query,
                projectRoot || '',
                searchExcludes,
                searchIncludes,
                searchMaxFileSize,
                searchCaseSensitive,
                searchWholeWord,
                searchRegex,
                openFilePaths
            );
            setResults(res);
        } catch (err) {
            setError(typeof err === 'string' ? err : 'Search failed');
            console.error(err);
        } finally {
            setIsSearching(false);
        }
    };

    const handleReplacePreview = async () => {
        if (!query) return;

        const openFilePaths = getOpenFilePaths();
        if (!projectRoot && openFilePaths.length === 0) return;

        setIsSearching(true);
        clearResults();

        try {
            const res = await replaceFiles(
                query,
                replaceQuery,
                projectRoot || '',
                searchExcludes,
                searchIncludes,
                searchMaxFileSize,
                searchCaseSensitive,
                searchWholeWord,
                searchRegex,
                true, // Dry Run
                openFilePaths
            );
            setReplaceResults(res);
        } catch (err) {
            setError(typeof err === 'string' ? err : 'Preview failed');
        } finally {
            setIsSearching(false);
        }
    };

    const handleReplaceExecute = async () => {
        if (!query) return;

        const openFilePaths = getOpenFilePaths();
        if (!projectRoot && openFilePaths.length === 0) return;

        if (!confirm('Are you sure you want to replace all occurrences? This currently cannot be undone easily.')) return;

        setIsSearching(true);
        // Clean results but maybe keep preview? nah, refresh.

        try {
            await replaceFiles(
                query,
                replaceQuery,
                projectRoot || '',
                searchExcludes,
                searchIncludes,
                searchMaxFileSize,
                searchCaseSensitive,
                searchWholeWord,
                searchRegex,
                false, // Execute
                openFilePaths
            );
            // Refresh search to show it's gone? or clear?
            // Let's clear and show success message or re-search
            clearResults();
            setError("Replacement complete!");
            // Re-run search to verify? 
            // handleSearch(); // Might be empty now
        } catch (err) {
            setError(typeof err === 'string' ? err : 'Replace failed');
        } finally {
            setIsSearching(false);
        }
    };

    const handleResultClick = (filePath: string, line: number) => {
        addTab(filePath);
        setCursorPos({ line, col: 1 });
    };

    const openFilePaths = getOpenFilePaths();
    if (!projectRoot && openFilePaths.length === 0) {
        return <div className="search-view-empty">Open a file or project to search</div>;
    }


    return (
        <div className="search-view">
            <div className="search-header">
                <div className="search-title-bar">
                    <span className="search-title">SEARCH</span>
                </div>

                <form onSubmit={handleSearch}>
                    <button type="submit" style={{ display: 'none' }} />
                    <div className="search-container">
                        <div className="search-box-row">
                            <button
                                type="button"
                                className={`toggle-replace-icon ${isReplaceMode ? 'expanded' : ''}`}
                                onClick={() => setIsReplaceMode(!isReplaceMode)}
                                title="Toggle Replace"
                            >
                                <ChevronRight size={14} />
                            </button>

                            <div className="input-field-wrapper">
                                <input
                                    type="text"
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleSearch(e);
                                    }}
                                    placeholder="Search"
                                    className="search-input"
                                />
                                <div className="input-actions">
                                    <button
                                        type="button"
                                        className={`action-icon ${searchCaseSensitive ? 'active' : ''}`}
                                        onClick={() => setSearchCaseSensitive(!searchCaseSensitive)}
                                        title="Match Case (Alt+C)"
                                    >
                                        <span className="icon-text">Aa</span>
                                    </button>
                                    <button
                                        type="button"
                                        className={`action-icon ${searchWholeWord ? 'active' : ''}`}
                                        onClick={() => setSearchWholeWord(!searchWholeWord)}
                                        title="Match Whole Word (Alt+W)"
                                    >
                                        <span className="icon-text">ab</span>
                                    </button>
                                    <button
                                        type="button"
                                        className={`action-icon ${searchRegex ? 'active' : ''}`}
                                        onClick={() => setSearchRegex(!searchRegex)}
                                        title="Use Regular Expression (Alt+R)"
                                    >
                                        <span className="icon-text">.*</span>
                                    </button>
                                </div>
                            </div>
                        </div>

                        {isReplaceMode && (
                            <div className="search-box-row replace-box-row">
                                <div className="spacer-icon"></div>
                                <div className="input-field-wrapper">
                                    <input
                                        type="text"
                                        value={replaceQuery}
                                        onChange={(e) => setReplaceQuery(e.target.value)}
                                        placeholder="Replace"
                                        className="search-input"
                                    />
                                    <div className="input-actions">
                                        <button
                                            type="button"
                                            className="action-icon"
                                            onClick={handleReplaceExecute}
                                            title="Replace All (Ctrl+Alt+Enter)"
                                        >
                                            <span className="icon-text">All</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </form>

                <div className="details-section">
                    <div className="search-details-toggle" onClick={() => setShowDetails(!showDetails)}>
                        <span className="dots-icon">...</span>
                    </div>
                </div>

                {showDetails && (
                    <div className="search-details-panel">
                        <div className="detail-group">
                            <label>files to include</label>
                            <input
                                type="text"
                                value={searchIncludes.join(', ')}
                                onChange={(e) => setSearchIncludes(e.target.value.split(',').map(s => s.trim()))}
                                placeholder="e.g. src/*.ts"
                                className="detail-input"
                            />
                        </div>
                        <div className="detail-group">
                            <label>files to exclude</label>
                            <input
                                type="text"
                                value={searchExcludes.join(', ')}
                                onChange={(e) => setSearchExcludes(e.target.value.split(',').map(s => s.trim()))}
                                placeholder="e.g. node_modules"
                                className="detail-input"
                            />
                        </div>
                    </div>
                )}
            </div>

            <div className="search-results">
                {isSearching && <div className="search-loading">Processing...</div>}
                {error && <div className="search-error">{error}</div>}

                {/* Normal Search Results */}
                {!isReplaceMode && results.map((res, i) => {
                    const fileName = res.file_path.split(/[\\/]/).pop();
                    const relativePath = res.file_path.replace(projectRoot || '', '').replace(/^[\\/]/, '');

                    return (
                        <div key={i} className="search-result-item" onClick={() => handleResultClick(res.file_path, res.line_number)}>
                            <div className="result-file" title={res.file_path}>
                                <span className="file-name">{fileName}</span>
                                <span className="file-path">{relativePath}</span>
                            </div>
                            <div className="result-preview">
                                <span className="line-num">{res.line_number}:</span>
                                <span className="line-content">{res.line_content}</span>
                            </div>
                        </div>
                    );
                })}

                {/* Replace Preview Results */}
                {isReplaceMode && replaceResults.length === 0 && !isSearching && query && (
                    <div className="preview-hint">
                        <button onClick={handleReplacePreview}>Show Preview</button>
                    </div>
                )}

                {isReplaceMode && replaceResults.map((res, i) => {
                    const fileName = res.file_path.split(/[\\/]/).pop();
                    const relativePath = res.file_path.replace(projectRoot || '', '').replace(/^[\\/]/, '');

                    return (
                        <div key={i} className="replace-result-group">
                            <div className="result-file header" title={res.file_path}>
                                <span className="file-name">{fileName}</span>
                                <span className="file-path">{relativePath}</span>
                                <span className="badge">{res.matches.length}</span>
                            </div>
                            {res.matches.map((match, j) => (
                                <div key={j} className="search-result-item replace-preview-item" onClick={() => handleResultClick(res.file_path, match.line)}>
                                    <div className="line-num">{match.line}:</div>
                                    <div className="replace-diff">
                                        <div className="original">{match.original}</div>
                                        <div className="arrow"><ArrowRight size={12} /></div>
                                        <div className="replacement">{match.replacement}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    );
                })}

                {!isSearching && results.length === 0 && replaceResults.length === 0 && query && (
                    <div className="search-empty">No results found</div>
                )}
            </div>
        </div>
    );
};

export default SearchView;
