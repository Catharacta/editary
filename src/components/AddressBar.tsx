import React from 'react';
import './AddressBar.css';

const AddressBar: React.FC = () => {
    return (
        <div className="address-bar">
            <div className="path-display">
                C:\Users\atuya\Documents\Untitled-1.txt
            </div>
            <button className="explorer-btn" title="Open in Explorer">
                📂
            </button>
        </div>
    );
};

export default AddressBar;
