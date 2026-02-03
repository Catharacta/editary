import React, { useEffect, useState } from 'react';
import { Moon, Sun, Settings, Search, Info } from 'lucide-react';
import { Store } from '@tauri-apps/plugin-store';
import { useAppStore } from '../store';
import './SettingsView.css';

interface AppSettings {
    theme: 'dark' | 'light';
    fontSize: number;
}

const SettingsView: React.FC = () => {
    const [activeSection, setActiveSection] = useState<'general' | 'search' | 'about'>('general');
    const [settings, setSettings] = useState<AppSettings>({
        theme: 'dark',
        fontSize: 14
    });
    const [store, setStore] = useState<Store | null>(null);

    // Get actions/state from global store
    const { setTheme, searchExcludes, searchMaxFileSize, setSearchExcludes, setSearchMaxFileSize } = useAppStore();

    // Initialize Store
    useEffect(() => {
        const initStore = async () => {
            try {
                const _store = await Store.load('settings.json');
                setStore(_store);

                const savedTheme = await _store.get<string>('theme');
                const savedFontSize = await _store.get<number>('fontSize');

                const initialTheme = (savedTheme as 'dark' | 'light') || 'dark';

                setSettings({
                    theme: initialTheme,
                    fontSize: savedFontSize || 14
                });

                // Sync global store
                setTheme(initialTheme);

            } catch (e) {
                console.error("Failed to load store:", e);
            }
        };
        initStore();
    }, [setTheme]);

    const handleThemeChange = async (theme: 'dark' | 'light') => {
        setSettings(prev => ({ ...prev, theme }));

        if (store) {
            await store.set('theme', theme);
            await store.save();
        }

        // Update global store
        setTheme(theme);
    };

    return (
        <div className="settings-view">
            <div className="settings-sidebar">
                <div
                    className={`settings-nav-item ${activeSection === 'general' ? 'active' : ''}`}
                    onClick={() => setActiveSection('general')}
                >
                    <Settings size={16} /> General
                </div>
                <div
                    className={`settings-nav-item ${activeSection === 'search' ? 'active' : ''}`}
                    onClick={() => setActiveSection('search')}
                >
                    <Search size={16} /> Search
                </div>
                <div
                    className={`settings-nav-item ${activeSection === 'about' ? 'active' : ''}`}
                    onClick={() => setActiveSection('about')}
                >
                    <Info size={16} /> About
                </div>
            </div>

            <div className="settings-content">
                <h1 className="settings-title">
                    {activeSection === 'general' && 'General Settings'}
                    {activeSection === 'search' && 'Search Settings'}
                    {activeSection === 'about' && 'About Editary'}
                </h1>

                {activeSection === 'general' && (
                    <div className="settings-section">
                        <h3>Theme</h3>
                        <div className="theme-options">
                            <label className={`theme-card ${settings.theme === 'light' ? 'selected' : ''}`}>
                                <input
                                    type="radio"
                                    name="theme"
                                    value="light"
                                    checked={settings.theme === 'light'}
                                    onChange={() => handleThemeChange('light')}
                                />
                                <div className="theme-preview light">
                                    <Sun size={24} />
                                </div>
                                <span>Light</span>
                            </label>
                            <label className={`theme-card ${settings.theme === 'dark' ? 'selected' : ''}`}>
                                <input
                                    type="radio"
                                    name="theme"
                                    value="dark"
                                    checked={settings.theme === 'dark'}
                                    onChange={() => handleThemeChange('dark')}
                                />
                                <div className="theme-preview dark">
                                    <Moon size={24} />
                                </div>
                                <span>Dark</span>
                            </label>
                        </div>
                    </div>
                )}

                {activeSection === 'search' && (
                    <div className="settings-section">
                        <h3>Search Limits</h3>
                        <div className="setting-row">
                            <div className="setting-label">
                                <label>Max File Size</label>
                                <span className="setting-desc">Files larger than this size (bytes) will be skipped during search.</span>
                            </div>
                            <div className="setting-control">
                                <input
                                    type="number"
                                    value={searchMaxFileSize}
                                    onChange={(e) => setSearchMaxFileSize(Number(e.target.value))}
                                />
                                <span className="unit">bytes</span>
                            </div>
                        </div>

                        <h3>Exclude Patterns</h3>
                        <div className="setting-row">
                            <div className="setting-label">
                                <label>Global Excludes</label>
                                <span className="setting-desc">Comma-separated list of folder/file names to exclude. .gitignore is always respected.</span>
                            </div>
                            <div className="setting-control">
                                <input
                                    type="text"
                                    value={searchExcludes.join(', ')}
                                    onChange={(e) => setSearchExcludes(e.target.value.split(',').map(s => s.trim()).filter(s => s))}
                                    placeholder="dist, build, out"
                                    style={{ width: '300px' }}
                                />
                            </div>
                        </div>
                    </div>
                )}

                {activeSection === 'about' && (
                    <div className="settings-section">
                        <h3>Editary</h3>
                        <p>Version 0.1.0</p>
                        <p>A high-performance modern text editor built with Tauri and React.</p>

                        <h4 style={{ marginTop: '20px' }}>Licenses</h4>
                        <div className="licenses-list">
                            <p><strong>React</strong> - MIT License</p>
                            <p><strong>Tauri</strong> - MIT/Apache-2.0</p>
                            <p><strong>CodeMirror</strong> - MIT License</p>
                            <p><strong>Lucide</strong> - ISC License</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SettingsView;
