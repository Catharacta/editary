import React, { useEffect, useState } from 'react';
import { X, Moon, Sun } from 'lucide-react';
import { Store } from '@tauri-apps/plugin-store';
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

    // Initialize Store
    useEffect(() => {
        const initStore = async () => {
            try {
                // Correct way to initialize store in v2 if constructor is private
                // However, based on some v2 examples, `new Store` IS used.
                // The lint might be confused or using a different version type definition.
                // If `Store.load` exists, we use it. If not, we try `new`.
                // Checking the lint error "Constructor of class 'Store' is private", it implies we MUST use a static method.
                // Commonly `load`.
                const _store = await Store.load('settings.json');
                setStore(_store);

                const savedTheme = await _store.get<string>('theme');
                const savedFontSize = await _store.get<number>('fontSize');

                setSettings({
                    theme: (savedTheme as 'dark' | 'light') || 'dark',
                    fontSize: savedFontSize || 14
                });

                // Initial apply
                if (savedTheme === 'light') {
                    document.body.classList.add('light-theme');
                } else {
                    document.body.classList.remove('light-theme');
                }

            } catch (e) {
                console.error("Failed to load store:", e);
                // Fallback or retry?
            }
        };
        initStore();
    }, []);

    // Sync when modal opens (optional if we want real-time update reflects)
    // For now, initStore covers initial load.

    const handleThemeChange = async (theme: 'dark' | 'light') => {
        setSettings(prev => ({ ...prev, theme }));

        if (store) {
            await store.set('theme', theme);
            await store.save();
        }

        document.body.classList.toggle('light-theme', theme === 'light');
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
