import React from 'react';
import { useAppStore } from '../store';
import './AddressBar.css';
// import { invoke } from '@tauri-apps/api/core';

const AddressBar: React.FC = () => {
    const { tabs, activeTabId } = useAppStore();
    const activeTab = tabs.find(t => t.id === activeTabId);

    const handleRevealInExplorer = () => {
        if (activeTab?.path) {
            // Future implementation: invoke('reveal_in_explorer', { path: activeTab.path });
            console.log("Reveal in explorer:", activeTab.path);
        }
    };

    return (
        <div className="address-bar">
            <div className="path-display" title={activeTab?.path || ''}>
                {activeTab?.path || (activeTab ? `[Draft] ${activeTab.displayName}` : '')}
            </div>
            <button
                className="explorer-btn"
                title="Open in Explorer"
                disabled={!activeTab?.path}
                onClick={handleRevealInExplorer}
            >
                📂
            </button>
        </div>
    );
};

export default AddressBar;
