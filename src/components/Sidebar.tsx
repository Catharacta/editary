
import React from 'react';
import { useAppStore } from '../store';
import ExplorerView from './ExplorerView';
import SearchView from './SearchView';
import './Sidebar.css';

const Sidebar: React.FC = () => {
    const { activeSidebarView } = useAppStore();

    return (
        <aside className="sidebar">
            <div style={{ display: activeSidebarView === 'explorer' ? 'block' : 'none', height: '100%' }}>
                <ExplorerView />
            </div>
            <div style={{ display: activeSidebarView === 'search' ? 'block' : 'none', height: '100%' }}>
                <SearchView />
            </div>
        </aside>
    );
};

export default Sidebar;
