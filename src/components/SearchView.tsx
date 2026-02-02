import React, { useState } from 'react';
import { useAppStore } from '../store';
import { searchFiles, SearchResult, openFile, watchFile } from '../api';
import './Sidebar.css'; // Re-use common sidebar styles

const SearchView: React.FC = () => {
    const { projectRoot, addTab, tabs, setActiveTab, setCursorPos, searchExcludes, searchMaxFileSize } = useAppStore();
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [isSearching, setIsSearching] = useState(false);

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!projectRoot || !query.trim()) return;

        setIsSearching(true);
        try {
            const res = await searchFiles(query, projectRoot, searchExcludes, searchMaxFileSize);
            setResults(res);
        } catch (err) {
            console.error("Search failed:", err);
            setResults([]);
        } finally {
            setIsSearching(false);
        }
    };

    const handleResultClick = async (result: SearchResult) => {
        // Open file
        // Check if already open
        const existing = tabs.find(t => t.path === result.file_path);

        if (existing) {
            setActiveTab(existing.id);
            setCursorPos({ line: result.line_number, col: 1 });
        } else {
            try {
                const fileRes = await openFile(result.file_path);
                const newTabId = addTab(result.file_path, fileRes.content);
                await watchFile(result.file_path);
                // We need to set cursor pos after tab is added. 
                // Since state update might be async, we set it immediately 
                // and rely on Editor component to pick it up or useEffect sync.
                setCursorPos({ line: result.line_number, col: 1 });
            } catch (err) {
                console.error("Failed to open file from search:", err);
            }
        }
    };

    return (
        <div className="sidebar-view search-view" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div className="section-header">
                <span className="header-title">SEARCH</span>
            </div>

            <div style={{ padding: '8px' }}>
                <form onSubmit={handleSearch}>
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder={projectRoot ? "Search in project..." : "Open folder to search"}
                        disabled={!projectRoot}
                        style={{
                            width: '100%',
                            padding: '6px',
                            backgroundColor: 'var(--bg-active)', // slightly lighter input
                            border: '1px solid var(--border-color)',
                            color: 'var(--text-primary)',
                            borderRadius: '2px',
                            fontSize: '12px'
                        }}
                    />
                </form>
            </div>

            <div className="section-content scrollable" style={{ flex: 1, overflowY: 'auto' }}>
                {!projectRoot && (
                    <div className="empty-explorer" style={{ padding: '20px' }}>
                        No project opened.
                    </div>
                )}

                {projectRoot && results.length === 0 && query && !isSearching && (
                    <div style={{ padding: '8px 16px', fontSize: '12px', opacity: 0.7 }}>
                        No results found.
                    </div>
                )}

                {isSearching && (
                    <div style={{ padding: '8px 16px', fontSize: '12px', opacity: 0.7 }}>
                        Searching...
                    </div>
                )}

                {results.length > 0 && (
                    <div className="search-results">
                        {results.map((res, idx) => {
                            // Extract relative path calculation logic if needed, 
                            // for now just show filename or partial path if desired, 
                            // but user requirement said "grouped by file".
                            // For MVP, just flat list is easier or grouping.
                            // Let's optimize display a bit: Filename (Path) \n Line content
                            const fileName = res.file_path.split(/[\\/]/).pop();
                            const relativePath = projectRoot ? res.file_path.replace(projectRoot, '') : res.file_path;

                            return (
                                <div
                                    key={idx}
                                    className="file-item search-result-item"
                                    style={{ flexDirection: 'column', alignItems: 'flex-start', height: 'auto', padding: '6px 16px' }}
                                    onClick={() => handleResultClick(res)}
                                >
                                    <div style={{ fontWeight: 'bold', fontSize: '12px', display: 'flex', width: '100%' }}>
                                        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {fileName} <span style={{ opacity: 0.5, fontSize: '10px' }}>{relativePath}</span>
                                        </span>
                                        <span style={{ marginLeft: 'auto', fontSize: '10px', opacity: 0.8 }}>:{res.line_number}</span>
                                    </div>
                                    <div style={{ fontSize: '11px', opacity: 0.7, whiteSpace: 'pre', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%', marginTop: '2px' }}>
                                        {res.line_content}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

export default SearchView;
