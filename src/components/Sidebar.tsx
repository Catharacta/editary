
import React, { useState } from 'react';
import { useAppStore } from '../store';
import { open } from '@tauri-apps/plugin-dialog';
import { openFile, watchFile, unwatchFile } from '../api';
import { FileText, FileEdit, X, FolderOpen, FilePlus } from 'lucide-react';
import FileTree from './FileTree';
import './Sidebar.css';

const Sidebar: React.FC = () => {
    const {
        tabs, panes, activePaneId,
        setActiveTab, closeTab, addTab,
        projectRoot, openProject
    } = useAppStore();

    // Accordion State
    const [isEditorsOpen, setIsEditorsOpen] = useState(true);
    const [isProjectOpen, setIsProjectOpen] = useState(true);

    const activeTabId = panes[activePaneId].activeTabId;

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
                openTabWithPath(path);
            }
        } catch (err) {
            console.error("Failed to open file:", err);
        }
    };

    const openTabWithPath = async (path: string) => {
        const existing = tabs.find(t => t.path === path);
        if (existing) {
            setActiveTab(existing.id);
            return;
        }

        try {
            const result = await openFile(path);
            addTab(path, result.content);
            await watchFile(path);
        } catch (err) {
            console.error("Failed to open/watch file:", err);
        }
    };

    const handleOpenFolder = async () => {
        try {
            const selected = await open({
                directory: true,
                multiple: false,
                recursive: true
            });
            if (selected) {
                openProject(selected as string);
                setIsProjectOpen(true); // Ensure it opens
            }
        } catch (err) {
            console.error("Failed to open folder:", err);
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
            {/* --- OPEN EDITORS SECTION --- */}
            <div className={`sidebar-section ${isEditorsOpen ? 'expanded' : 'collapsed'} editors-section`}>
                <div
                    className="section-header"
                    onClick={() => setIsEditorsOpen(!isEditorsOpen)}
                >
                    <span className="toggle-icon">{isEditorsOpen ? '▼' : '▶'}</span>
                    <span className="header-title">OPEN EDITORS</span>
                </div>

                <div className="section-content" style={{ display: isEditorsOpen ? 'block' : 'none' }}>
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
                    {/* Action Row */}
                    <div className="action-row">
                        <button className="action-btn" onClick={() => addTab()} title="New File">
                            <FilePlus size={14} />
                        </button>
                        <button className="action-btn" onClick={handleOpenFile} title="Open File">
                            <FolderOpen size={14} />
                        </button>
                    </div>
                </div>
            </div>

            {/* --- PROJECT SECTION --- */}
            <div className={`sidebar-section ${isProjectOpen ? 'expanded' : 'collapsed'} project-section`}>
                <div
                    className="section-header"
                    onClick={() => setIsProjectOpen(!isProjectOpen)}
                >
                    <span className="toggle-icon">{isProjectOpen ? '▼' : '▶'}</span>
                    <span className="header-title">
                        PROJECT {projectRoot ? `(${projectRoot.split(/[\\/]/).pop()})` : ''}
                    </span>
                    <div className="actions" onClick={e => e.stopPropagation()}>
                        <button className="icon-btn" onClick={handleOpenFolder} title="Open Folder">
                            <FolderOpen size={14} />
                        </button>
                    </div>
                </div>

                <div className="section-content scrollable" style={{ display: isProjectOpen ? 'block' : 'none' }}>
                    {projectRoot ? (
                        <FileTree rootPath={projectRoot} />
                    ) : (
                        <div className="empty-explorer">
                            <p>No folder opened.</p>
                            <button onClick={handleOpenFolder}>Open Folder</button>
                        </div>
                    )}
                </div>
            </div>
        </aside>
    );
};

export default Sidebar;
