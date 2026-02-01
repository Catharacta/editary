import React from 'react';
import './Toast.css';

interface ToastProps {
    message: string;
    onReload: () => void;
    onIgnore: () => void;
}

const Toast: React.FC<ToastProps> = ({ message, onReload, onIgnore }) => {
    return (
        <div className="toast-container">
            <div className="toast-message">{message}</div>
            <div className="toast-actions">
                <button onClick={onReload} className="toast-btn primary">Reload</button>
                <button onClick={onIgnore} className="toast-btn secondary">Ignore</button>
            </div>
        </div>
    );
};

export default Toast;
