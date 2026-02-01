import React from 'react';
import { useAppStore } from '../store';
import './Sidebar.css';

const Sidebar: React.FC = () => {
    const { tabs, activeTabId, setActiveTab, closeTab, addTab } = useAppStore();

    // Debug: Add a tab if empty
    React.useEffect(() => {
        if (tabs.length === 0) {
            addTab();
        }
    }, [tabs.length, addTab]);

    return (
        <aside className="sidebar">
            <div className="sidebar-header">
                Files
                <button
                    className="add-tab-btn"
                    onClick={() => addTab()}
                    title="New File"
                >+</button>
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
                            {tab.path ? '📄' : '📝'}
                        </span>
                        <span className="file-name">
                            {tab.displayName}
                            {tab.isDirty && <span className="dirty-indicator">●</span>}
                        </span>
                        <button
                            className="close-tab-btn"
                            onClick={(e) => {
                                e.stopPropagation();
                                closeTab(tab.id);
                            }}
                        >×</button>
                    </li>
                ))}
            </ul>
        </aside>
    );
};

export default Sidebar;
