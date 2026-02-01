import React from 'react';
import './StatusBar.css';

const StatusBar: React.FC = () => {
    return (
        <footer className="status-bar">
            <div className="status-item">Ln 1, Col 1</div>
            <div className="status-item">UTF-8</div>
            <div className="status-item">CRLF</div>
        </footer>
    );
};

export default StatusBar;
