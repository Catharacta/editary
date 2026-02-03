import React from 'react';
import { Files, Search } from 'lucide-react';
import { useAppStore } from '../store';
import './ActivityBar.css';

const ActivityBar: React.FC = () => {
    const { activeSidebarView, setActiveSidebarView } = useAppStore();

    return (
        <div className="activity-bar">
            <div
                className={`activity-icon ${activeSidebarView === 'explorer' ? 'active' : ''}`}
                onClick={() => setActiveSidebarView('explorer')}
                title="Explorer"
            >
                <Files size={24} strokeWidth={1.5} />
            </div>
            <div
                className={`activity-icon ${activeSidebarView === 'search' ? 'active' : ''}`}
                onClick={() => setActiveSidebarView('search')}
                title="Search"
            >
                <Search size={24} strokeWidth={1.5} />
            </div>
        </div>
    );
};

export default ActivityBar;
