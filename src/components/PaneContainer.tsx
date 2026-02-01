import React from 'react';
import { PaneId } from '../store';
import AddressBar from './AddressBar';
import EditorComponent from './EditorComponent'; // Ensure this path is correct relative to PaneContainer location

// Assuming PaneContainer will be in src/components/PaneContainer.tsx
// Adjust imports if needed.

interface PaneContainerProps {
    paneId: PaneId;
}

const PaneContainer: React.FC<PaneContainerProps> = ({ paneId }) => {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
            <AddressBar paneId={paneId} />
            <EditorComponent paneId={paneId} />
        </div>
    );
};

export default PaneContainer;
