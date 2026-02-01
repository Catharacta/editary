import React from 'react';
import { useAppStore } from '../store';
import './AddressBar.css';

const AddressBar: React.FC = () => {
    const { tabs, activeTabId } = useAppStore();
    const activeTab = tabs.find(t => t.id === activeTabId);

    return (
        <div className="address-bar">
            <div className="path-display" title={activeTab?.path || ''}>
                {activeTab?.path || (activeTab ? `[Draft] ${activeTab.displayName}` : '')}
            </div>
        </div>
    );
};

export default AddressBar;
