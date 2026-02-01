import React from 'react';
import { useAppStore } from '../store';
import { open } from '@tauri-apps/plugin-dialog';
import { openFile, watchFile, unwatchFile } from '../api';
import { FileText, FileEdit, X, FolderOpen, FilePlus } from 'lucide-react';
import './Sidebar.css';

const Sidebar: React.FC = () => {
    const { tabs, activeTabId, setActiveTab, closeTab, addTab } = useAppStore();

    // Debug: Add a tab if empty (only on first load)
    React.useEffect(() => {
        if (tabs.length === 0) {
            // addTab(); 
        }
    }, [tabs.length, addTab]);

    const handleOpenFile = async () => {
        try {
            const selected = await open({
                multiple: false,
                filters: [{
                    name: 'Text',
                    extensions: ['txt', 'md', 'rs', 'ts', 'tsx', 'js', 'json', 'css', 'html', 'toml', 'yaml', 'lock', 'xml']
                }]
            });

            if (selected) {
                const path = selected as string;

                const existing = tabs.find(t => t.path === path);
                if (existing) {
                    setActiveTab(existing.id);
                    return;
                }

                const result = await openFile(path);
                addTab(path, result.content);
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
                    >
                        <FolderOpen size={16} />
                    </button>
                    <button
                        className="add-tab-btn"
                        onClick={() => addTab()}
                        title="New File"
                    >
                        <FilePlus size={16} />
                    </button>
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
                            {tab.path ? <FileText size={14} /> : <FileEdit size={14} />}
                        </span>
                        <span className="file-name">
                            {tab.displayName}
                            {tab.isDirty && <span className="dirty-indicator">●</span>}
                        </span>
                        <button
                            className="close-tab-btn"
                            onClick={(e) => handleCloseTab(tab.id, tab.path, e)}
                        >
                            <X size={12} />
                        </button>
                    </li>
                ))}
            </ul>
        </aside>
    );
};

export default Sidebar;
