import React from 'react';
import { useAppStore } from '../store';
import { open } from '@tauri-apps/plugin-dialog';
import { openFile, watchFile, unwatchFile } from '../api';
import './Sidebar.css';

const Sidebar: React.FC = () => {
    const { tabs, activeTabId, setActiveTab, closeTab, addTab } = useAppStore();

    // Debug: Add a tab if empty (only on first load)
    React.useEffect(() => {
        if (tabs.length === 0) {
            // addTab(); // Don't auto-add untitled for now to test "Open"
        }
    }, [tabs.length, addTab]);

    const handleOpenFile = async () => {
        try {
            const selected = await open({
                multiple: false,
                filters: [{
                    name: 'Text',
                    extensions: ['txt', 'md', 'rs', 'ts', 'tsx', 'js', 'json', 'css', 'html', 'toml', 'yaml']
                }]
            });

            if (selected) {
                const path = selected as string; // Single file

                // Check if already open
                const existing = tabs.find(t => t.path === path);
                if (existing) {
                    setActiveTab(existing.id);
                    return;
                }

                const result = await openFile(path);
                addTab(path, result.content);
                // Watch file
                await watchFile(path);
            }
        } catch (err) {
            console.error("Failed to open file:", err);
        }
    };

    const handleCloseTab = async (id: string, path: string | null, e: React.MouseEvent) => {
        e.stopPropagation();
        if (path) {
            await unwatchFile(path);
        }
        closeTab(id);
    };

    return (
        <aside className="sidebar">
            <div className="sidebar-header">
                Files
                <div className="actions">
                    <button
                        className="add-tab-btn"
                        onClick={handleOpenFile}
                        title="Open File"
                    >📂</button>
                    <button
                        className="add-tab-btn"
                        onClick={() => addTab()}
                        title="New File"
                    >+</button>
                </div>
            </div>
            <ul className="file-list">
                {tabs.map(tab => (
                    <li
                        key={tab.id}
                        className={`file-item ${tab.id === activeTabId ? 'active' : ''}`}
                        onClick={() => setActiveTab(tab.id)}
                        title={tab.path || tab.displayName}
                    >
                        <span className="file-icon">
                            {tab.path ? '📄' : '📝'}
                        </span>
                        <span className="file-name">
                            {tab.displayName}
                            {tab.isDirty && <span className="dirty-indicator">●</span>}
                        </span>
                        <button
                            className="close-tab-btn"
                            onClick={(e) => handleCloseTab(tab.id, tab.path, e)}
                        >×</button>
                    </li>
                ))}
            </ul>
        </aside>
    );
};

export default Sidebar;
