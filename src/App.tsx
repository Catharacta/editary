import React, { useEffect, useState } from 'react';
import { listen } from '@tauri-apps/api/event';
import './App.css';
import Sidebar from './components/Sidebar';
import AddressBar from './components/AddressBar';
import EditorComponent from './components/EditorComponent';
import StatusBar from './components/StatusBar';
import Toast from './components/Toast';
import { useAppStore } from './store';
import { openFile } from './api';

function App() {
  const { tabs, updateTabContent } = useAppStore();
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [changedFilePath, setChangedFilePath] = useState<string | null>(null);

  useEffect(() => {
    const unlisten = listen<string>('file-changed', (event) => {
      const path = event.payload;
      // Check if this file is open
      const tab = tabs.find(t => t.path === path);
      if (tab) {
        setChangedFilePath(path);
        setToastMessage(`File changed externally: ${tab.displayName}`);
      }
    });

    return () => {
      unlisten.then(f => f());
    };
  }, [tabs]); // Re-bind if tabs change? Better to use ref for tabs to avoid re-binding

  const handleReload = async () => {
    if (changedFilePath) {
      try {
        const result = await openFile(changedFilePath);
        const tab = tabs.find(t => t.path === changedFilePath);
        if (tab) {
          updateTabContent(tab.id, result.content, false); // Reload clean
        }
        setToastMessage(null);
        setChangedFilePath(null);
      } catch (e) {
        console.error("Failed to reload", e);
      }
    }
  };

  const handleIgnore = () => {
    setToastMessage(null);
    setChangedFilePath(null);
  };

  return (
    <div className="app-container">
      <Sidebar />
      <div className="main-area">
        <AddressBar />
        <EditorComponent />
        <StatusBar />
      </div>
      {toastMessage && (
        <Toast
          message={toastMessage}
          onReload={handleReload}
          onIgnore={handleIgnore}
        />
      )}
    </div>
  );
}

export default App;
