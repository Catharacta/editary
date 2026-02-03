import React from 'react';
import { PaneId, useAppStore } from '../store';
import AddressBar from './AddressBar';
import EditorComponent from './EditorComponent';
import SettingsView from './SettingsView';

interface PaneContainerProps {
    paneId: PaneId;
}

const PaneContainer: React.FC<PaneContainerProps> = ({ paneId }) => {
    const { panes, tabs } = useAppStore();
    const activeTabId = panes[paneId].activeTabId;
    const activeTab = activeTabId ? tabs.find(t => t.id === activeTabId) : null;

    return (
        <div className="pane-container" style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
            <AddressBar paneId={paneId} />
            <div style={{ flex: 1, overflow: 'hidden' }}>
                {activeTab?.type === 'settings' ? (
                    <SettingsView />
                ) : (
                    <EditorComponent paneId={paneId} />
                )}
            </div>
        </div>
    );
};

export default PaneContainer;
