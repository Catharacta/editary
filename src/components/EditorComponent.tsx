import React from 'react';
import './EditorComponent.css';

const EditorComponent: React.FC = () => {
    return (
        <div className="editor-container">
            {/* CodeMirror will be mounted here */}
            <div className="codemirror-placeholder">
                CodeMirror Content Here
            </div>
        </div>
    );
};

export default EditorComponent;
