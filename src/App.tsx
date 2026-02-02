import { useEffect, useState } from 'react';
import { listen } from '@tauri-apps/api/event';
import './App.css';
import Sidebar from './components/Sidebar';
import ActivityBar from './components/ActivityBar';
import PaneContainer from './components/PaneContainer';
import StatusBar from './components/StatusBar';
import Toast from './components/Toast';
import Toolbar from './components/Toolbar';
import { useAppStore } from './store';
import { openFile } from './api';

function App() {
  const { tabs, reloadTabContent, theme, isSplit, panes, addTab, setActiveTab } = useAppStore();
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [changedFilePath, setChangedFilePath] = useState<string | null>(null);

  // Apply Theme Logic
  useEffect(() => {
    if (theme === 'light') {
      document.body.classList.add('light-theme');
    } else {
      document.body.classList.remove('light-theme');
    }
  }, [theme]);

  // File Watcher Logic
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
          reloadTabContent(tab.id, result.content);
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

  const handleOpenSettings = () => {
    const existing = tabs.find(t => t.type === 'settings');
    if (existing) {
      setActiveTab(existing.id);
    } else {
      const id = addTab(undefined, undefined, 'settings');
      setActiveTab(id);
    }
  };

  return (
    <div className="app-container">
      <Toolbar onOpenSettings={handleOpenSettings} />
      <div className="content-area">
        <ActivityBar />
        <div style={{ width: '250px', display: 'flex', flexDirection: 'column' }}>
          <Sidebar />
        </div>
        <div className="main-area">
          {/* Global AddressBar removed, it's now per-pane */}
          <div className="input-area" style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
            <PaneContainer
              key={`primary-${panes.primary.activeTabId}`}
              paneId="primary"
            />
            {isSplit && (
              <>
                <div style={{ width: '1px', background: 'var(--border-color)' }}></div>
                <PaneContainer
                  key={`secondary-${panes.secondary.activeTabId}`}
                  paneId="secondary"
                />
              </>
            )}
          </div>
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
    </div>
  );
}

export default App;
