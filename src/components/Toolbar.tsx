import React from 'react';
import { Save, Settings, Undo, Redo, Columns, XSquare } from 'lucide-react';
import { useAppStore } from '../store';
import { saveFile, watchFile, unwatchFile } from '../api';
import { save } from '@tauri-apps/plugin-dialog';
import './Toolbar.css';

interface ToolbarProps {
    onOpenSettings: () => void;
}

const Toolbar: React.FC<ToolbarProps> = ({ onOpenSettings }) => {
    const { tabs, panes, activePaneId, updateTabContent, updateTabState, isSplit, enableSplit, disableSplit } = useAppStore();
    const activeTabId = panes[activePaneId].activeTabId;
    const activeTab = tabs.find(t => t.id === activeTabId);

    const performSave = async (path: string, content: string) => {
        try {
            await unwatchFile(path).catch(() => { });
            await saveFile(path, content);
            await watchFile(path);
            return true;
        } catch (e) {
            console.error("Save failed internal", e);
            throw e;
        }
    };

    const handleSave = async () => {
        if (!activeTab) return;

        try {
            if (activeTab.path) {
                await performSave(activeTab.path, activeTab.content);
                updateTabContent(activeTab.id, activeTab.content, false);
            } else {
                const selectedPath = await save({
                    filters: [{
                        name: 'Text',
                        extensions: ['txt', 'md', 'rs', 'ts', 'tsx', 'js', 'json', 'css', 'html']
                    }]
                });

                if (selectedPath) {
                    await saveFile(selectedPath, activeTab.content);
                    await watchFile(selectedPath);

                    const fileName = selectedPath.split(/[\\/]/).pop() || 'Unknown';
                    updateTabState(activeTab.id, {
                        path: selectedPath,
                        displayName: fileName,
                        isDirty: false
                    });
                }
            }
        } catch (e) {
            console.error("Save failed", e);
        }
    };

    const handleUndo = () => {
        window.dispatchEvent(new CustomEvent('editor:undo'));
    };

    const handleRedo = () => {
        window.dispatchEvent(new CustomEvent('editor:redo'));
    };

    return (
        <div className="toolbar">
            <div className="toolbar-group">
                <button
                    className="toolbar-btn"
                    onClick={handleUndo}
                    disabled={!activeTab}
                    title="Undo"
                >
                    <Undo size={18} />
                </button>
                <button
                    className="toolbar-btn"
                    onClick={handleRedo}
                    disabled={!activeTab}
                    title="Redo"
                >
                    <Redo size={18} />
                </button>
            </div>

            <div className="toolbar-group">
                <button
                    className="toolbar-btn"
                    onClick={handleSave}
                    disabled={!activeTab}
                    title={activeTab?.path ? "Save" : "Save As"}
                >
                    <Save size={18} className={activeTab?.isDirty ? 'icon-dirty' : ''} />
                </button>
            </div>
            <div className="toolbar-spacer" />
            <div className="toolbar-group">
                {!isSplit ? (
                    <button className="toolbar-btn" title="Split Editor" onClick={enableSplit}>
                        <Columns size={18} />
                    </button>
                ) : (
                    <button className="toolbar-btn" title="Close Split" onClick={disableSplit}>
                        <XSquare size={18} />
                    </button>
                )}
                <button className="toolbar-btn" title="Settings" onClick={onOpenSettings}>
                    <Settings size={18} />
                </button>
            </div>
        </div>
    );
};

export default Toolbar;
