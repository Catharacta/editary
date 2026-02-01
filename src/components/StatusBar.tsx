import React from 'react';
import { useAppStore } from '../store';
import './StatusBar.css';

const StatusBar: React.FC = () => {
    const { cursorPos, tabs, panes, activePaneId } = useAppStore();
    const activeTabId = panes[activePaneId].activeTabId;
    const activeTab = tabs.find(t => t.id === activeTabId);

    // Encoding could be pulled from tab if we stored it (openFile returns it)
    // For now hardcode UTF-8 as standard, or update store to hold encoding
    const encoding = "UTF-8";

    return (
        <footer className="status-bar">
            {activeTab && (
                <>
                    <div className="status-item">Ln {cursorPos.line}, Col {cursorPos.col}</div>
                    <div className="status-item">{encoding}</div>
                    <div className="status-item">CRLF</div>
                </>
            )}
        </footer>
    );
};

export default StatusBar;
