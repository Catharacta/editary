import React, { useState } from 'react';
import { useAppStore } from '../store';
import { searchFiles, SearchResult } from '../api';
import './SearchView.css';
import { ChevronRight, ChevronDown } from 'lucide-react';

const SearchView: React.FC = () => {
    const {
        projectRoot,
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
        setSearchRegex
    } = useAppStore();

    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showDetails, setShowDetails] = useState(false);

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!projectRoot || !query) return;

        setIsSearching(true);
        setError(null);
        setResults([]);

        try {
            const res = await searchFiles(
                query,
                projectRoot,
                searchExcludes,
                searchIncludes,
                searchMaxFileSize,
                searchCaseSensitive,
                searchWholeWord,
                searchRegex
            );
            setResults(res);
        } catch (err) {
            setError(typeof err === 'string' ? err : 'Search failed');
            console.error(err);
        } finally {
            setIsSearching(false);
        }
    };

    const handleResultClick = (res: SearchResult) => {
        const id = addTab(res.file_path);
        setCursorPos({ line: res.line_number, col: 1 });
    };

    if (!projectRoot) {
        return <div className="search-view-empty">Open a project to search</div>;
    }

    return (
        <div className="search-view">
            <div className="search-header">
                <form onSubmit={handleSearch}>
                    <div className="search-input-container">
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Search in files..."
                            className="search-input"
                        />
                        <div className="search-options">
                            <button
                                type="button"
                                className={`option-btn ${searchCaseSensitive ? 'active' : ''}`}
                                onClick={() => setSearchCaseSensitive(!searchCaseSensitive)}
                                title="Match Case"
                            >
                                <span style={{ fontSize: '10px', fontWeight: 'bold' }}>Aa</span>
                            </button>
                            <button
                                type="button"
                                className={`option-btn ${searchWholeWord ? 'active' : ''}`}
                                onClick={() => setSearchWholeWord(!searchWholeWord)}
                                title="Match Whole Word"
                            >
                                <span style={{ fontSize: '10px', fontWeight: 'bold' }}>ab</span>
                            </button>
                            <button
                                type="button"
                                className={`option-btn ${searchRegex ? 'active' : ''}`}
                                onClick={() => setSearchRegex(!searchRegex)}
                                title="Use Regular Expression"
                            >
                                <span style={{ fontSize: '10px', fontWeight: 'bold' }}>.*</span>
                            </button>
                        </div>
                    </div>
                </form>

                <div className="search-details-toggle" onClick={() => setShowDetails(!showDetails)}>
                    {showDetails ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    <span>files to include/exclude</span>
                </div>

                {showDetails && (
                    <div className="search-details-panel">
                        <div className="detail-row">
                            <label>files to include</label>
                            <input
                                type="text"
                                value={searchIncludes.join(', ')}
                                onChange={(e) => setSearchIncludes(e.target.value.split(',').map(s => s.trim()))}
                                placeholder="e.g. src/*.ts"
                            />
                        </div>
                        <div className="detail-row">
                            <label>files to exclude</label>
                            <input
                                type="text"
                                value={searchExcludes.join(', ')}
                                onChange={(e) => setSearchExcludes(e.target.value.split(',').map(s => s.trim()))}
                                placeholder="e.g. node_modules, dist"
                            />
                        </div>
                    </div>
                )}
            </div>

            <div className="search-results">
                {isSearching && <div className="search-loading">Searching...</div>}

                {error && <div className="search-error">{error}</div>}

                {results.map((res, i) => {
                    const fileName = res.file_path.split(/[\\/]/).pop();
                    const relativePath = res.file_path.replace(projectRoot, '').replace(/^[\\/]/, ''); // Strip leading slash?
                    // Better path handling might be needed but good for now.

                    return (
                        <div key={i} className="search-result-item" onClick={() => handleResultClick(res)}>
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

                {!isSearching && results.length === 0 && query && (
                    <div className="search-empty">No results found</div>
                )}
            </div>
        </div>
    );
};

export default SearchView;
