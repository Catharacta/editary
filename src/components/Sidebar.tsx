import React from 'react';
import './Sidebar.css';

const Sidebar: React.FC = () => {
    return (
        <aside className="sidebar">
            <div className="sidebar-header">
                Files
            </div>
            <ul className="file-list">
                {/* Placeholder for file tabs */}
                <li className="file-item active">
                    <span className="file-icon">📄</span>
                    <span className="file-name">Untitled-1.txt</span>
                </li>
                <li className="file-item">
                    <span className="file-icon">📝</span>
                    <span className="file-name">Note.md</span>
                </li>
            </ul>
        </aside>
    );
};

export default Sidebar;
