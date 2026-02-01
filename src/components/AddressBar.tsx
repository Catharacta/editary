import React from 'react';
import { useAppStore, PaneId } from '../store';
import './AddressBar.css';

interface AddressBarProps {
    paneId?: PaneId; // Optional for backward compatibility, but should be used now
}

const AddressBar: React.FC<AddressBarProps> = ({ paneId }) => {
    const { tabs, panes, activePaneId } = useAppStore();

    // Determine which tab ID to show.
    // If paneId is provided, use that pane's active tab.
    // If not (legacy/global), use the globally active pane's active tab.
    const targetPaneId = paneId || activePaneId;
    const targetTabId = panes[targetPaneId].activeTabId;

    const activeTab = tabs.find(t => t.id === targetTabId);

    return (
        <div className="address-bar">
            <div className="path-display" title={activeTab?.path || ''}>
                {activeTab?.path || (activeTab ? `[Draft] ${activeTab.displayName}` : '')}
            </div>
        </div>
    );
};

export default AddressBar;
