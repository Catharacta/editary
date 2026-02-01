import { useEffect, useState } from 'react';
import { listen } from '@tauri-apps/api/event';
import './App.css';
import Sidebar from './components/Sidebar';
import AddressBar from './components/AddressBar';
import EditorComponent from './components/EditorComponent';
import StatusBar from './components/StatusBar';
import Toast from './components/Toast';
import Toolbar from './components/Toolbar';
import SettingsModal from './components/SettingsModal';
import { useAppStore } from './store';
import { openFile } from './api';

function App() {
  const { tabs, updateTabContent, theme } = useAppStore();
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [changedFilePath, setChangedFilePath] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Apply Theme Logic
  useEffect(() => {
    if (theme === 'light') {
      document.body.classList.add('light-theme');
    } else {
      document.body.classList.remove('light-theme');
    }
  }, [theme]);

  useEffect(() => {
    const unlisten = listen<string>('file-changed', (event) => {
      const path = event.payload;
      const tab = tabs.find(t => t.path === path);
      if (tab) {
        setChangedFilePath(path);
        setToastMessage(`File changed externally: ${tab.displayName}`);
      }
    });

    return () => {
      unlisten.then(f => f());
    };
  }, [tabs]);

  const handleReload = async () => {
    if (changedFilePath) {
      try {
        const result = await openFile(changedFilePath);
        const tab = tabs.find(t => t.path === changedFilePath);
        if (tab) {
          updateTabContent(tab.id, result.content, false);
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
      <Toolbar onOpenSettings={() => setIsSettingsOpen(true)} />
      <div className="content-area">
        <Sidebar />
        <div className="main-area">
          <AddressBar />
          <EditorComponent />
          <StatusBar />
        </div>
      </div>
      {toastMessage && (
        <Toast
          message={toastMessage}
          onReload={handleReload}
          onIgnore={handleIgnore}
        />
      )}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
}

export default App;
