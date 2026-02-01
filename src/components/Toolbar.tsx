import React from 'react';
import { Save, Settings } from 'lucide-react';
import { useAppStore } from '../store';
import { saveFile } from '../api';
import './Toolbar.css';

interface ToolbarProps {
    onOpenSettings: () => void;
}

const Toolbar: React.FC<ToolbarProps> = ({ onOpenSettings }) => {
    const { tabs, activeTabId, updateTabContent } = useAppStore();
    const activeTab = tabs.find(t => t.id === activeTabId);

    const handleSave = async () => {
        if (activeTab && activeTab.path) {
            try {
                await saveFile(activeTab.path, activeTab.content);
                updateTabContent(activeTab.id, activeTab.content, false); // Clear dirty flag
            } catch (e) {
                console.error("Save failed", e);
            }
        } else if (activeTab) {
            console.log("Save as...");
        }
    };

    return (
        <div className="toolbar">
            <div className="toolbar-group">
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
