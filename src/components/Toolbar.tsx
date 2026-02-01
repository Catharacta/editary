import React from 'react';
import { Save, Settings, FolderOpen, FilePlus } from 'lucide-react';
import { useAppStore } from '../store';
import { openFile, watchFile, saveFile } from '../api';
import { open } from '@tauri-apps/plugin-dialog';
import './Toolbar.css';

interface ToolbarProps {
    onOpenSettings: () => void;
}

const Toolbar: React.FC<ToolbarProps> = ({ onOpenSettings }) => {
    const { tabs, activeTabId, updateTabContent, addTab, setActiveTab } = useAppStore();
    const activeTab = tabs.find(t => t.id === activeTabId);

    const handleSave = async () => {
        if (activeTab && activeTab.path) {
            try {
                await saveFile(activeTab.path, activeTab.content);
                updateTabContent(activeTab.id, activeTab.content, false); // Clear dirty flag
                // Toast logic is in App.tsx... maybe we'll move toast to Store or Context later
            } catch (e) {
                console.error("Save failed", e);
            }
        } else if (activeTab) {
            // Save As (New File) - Not implemented yet in Toolbar button logic
            console.log("Save as...");
        }
    };

    const handleOpen = async () => {
        try {
            const selected = await open({
                multiple: false,
                filters: [{
                    name: 'Text',
                    extensions: ['txt', 'md', 'rs', 'ts', 'tsx', 'js', 'json', 'css', 'html']
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
        } catch (e) { console.error(e); }
    };

    const handleNew = () => {
        addTab();
    };

    return (
        <div className="toolbar">
            <div className="toolbar-group">
                <button className="toolbar-btn" onClick={handleNew} title="New File">
                    <FilePlus size={18} />
                </button>
                <button className="toolbar-btn" onClick={handleOpen} title="Open File">
                    <FolderOpen size={18} />
                </button>
                <button
                    className="toolbar-btn"
                    onClick={handleSave}
                    disabled={!activeTab?.isDirty}
                    title="Save"
                >
                    <Save size={18} className={activeTab?.isDirty ? 'icon-dirty' : ''} />
                </button>
            </div>
            <div className="toolbar-spacer" />
            <div className="toolbar-group">
                <button className="toolbar-btn" title="Settings" onClick={onOpenSettings}>
                    <Settings size={18} />
                </button>
            </div>
        </div>
    );
};

export default Toolbar;
