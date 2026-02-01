import React, { useEffect, useState } from 'react';
import { X, Moon, Sun } from 'lucide-react';
import { Store } from '@tauri-apps/plugin-store';
import { useAppStore } from '../store';
import './SettingsModal.css';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

interface AppSettings {
    theme: 'dark' | 'light';
    fontSize: number;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
    const [settings, setSettings] = useState<AppSettings>({
        theme: 'dark',
        fontSize: 14
    });
    const [store, setStore] = useState<Store | null>(null);

    // Get setTheme action from global store
    const setTheme = useAppStore(state => state.setTheme);

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

                // Sync global store with loaded settings
                setTheme(initialTheme);

                // Initial apply handled by App.tsx observing global store

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

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>Settings</h2>
                    <button className="close-btn" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>
                <div className="modal-body">
                    <div className="setting-item">
                        <label>Theme</label>
                        <div className="toggle-group">
                            <button
                                className={`toggle-btn ${settings.theme === 'light' ? 'active' : ''}`}
                                onClick={() => handleThemeChange('light')}
                            >
                                <Sun size={16} /> Light
                            </button>
                            <button
                                className={`toggle-btn ${settings.theme === 'dark' ? 'active' : ''}`}
                                onClick={() => handleThemeChange('dark')}
                            >
                                <Moon size={16} /> Dark
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SettingsModal;
