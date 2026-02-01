import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { EditorState } from '@codemirror/state';

export interface Tab {
    id: string;
    path: string | null; // null for new untitled files
    displayName: string;
    content: string; // Text content
    isDirty: boolean;
    editorState?: EditorState;
}

export interface CursorPos {
    line: number;
    col: number;
}

interface AppState {
    tabs: Tab[];
    activeTabId: string | null;
    theme: 'dark' | 'light';
    cursorPos: CursorPos;

    addTab: (path?: string, content?: string) => string;
    closeTab: (id: string) => void;
    setActiveTab: (id: string) => void;
    updateTabContent: (id: string, content: string, isDirty?: boolean) => void;
    updateTabState: (id: string, newState: Partial<Tab>) => void;
    setEditorState: (id: string, state: EditorState) => void;
    setTheme: (theme: 'dark' | 'light') => void;
    setCursorPos: (pos: CursorPos) => void;
}

export const useAppStore = create<AppState>((set) => ({
    tabs: [],
    activeTabId: null,
    theme: 'dark',
    cursorPos: { line: 1, col: 1 },

    setTheme: (theme) => set({ theme }),
    setCursorPos: (pos) => set({ cursorPos: pos }),

    addTab: (path = undefined, content = '') => {
        const id = uuidv4();
        const displayName = path ? path.split(/[\\/]/).pop() || 'Unknown' : 'Untitled-1';
        // Logic for Untitled-N could be better, but MVP: Untitled-1

        // If untitled, verify name uniqueness or simple increment? 
        // For now simple.

        const newTab: Tab = {
            id,
            path: path ?? null,
            displayName,
            content,
            isDirty: false,
        };

        set((state) => ({
            tabs: [...state.tabs, newTab],
            activeTabId: id,
        }));

        return id;
    },

    closeTab: (id) => {
        set((state) => {
            const newTabs = state.tabs.filter((t) => t.id !== id);
            let newActiveId = state.activeTabId;

            if (state.activeTabId === id) {
                // If closing active tab, select the one before it, or after, or null
                if (newTabs.length > 0) {
                    newActiveId = newTabs[newTabs.length - 1].id;
                } else {
                    newActiveId = null;
                }
            }

            return {
                tabs: newTabs,
                activeTabId: newActiveId,
            };
        });
    },

    setActiveTab: (id) => {
        set({ activeTabId: id });
    },

    updateTabContent: (id, content, isDirty = true) => {
        set((state) => ({
            tabs: state.tabs.map((tab) =>
                tab.id === id ? { ...tab, content, isDirty } : tab
            ),
        }));
    },

    updateTabState: (id, newState) => {
        set((state) => ({
            tabs: state.tabs.map((tab) =>
                tab.id === id ? { ...tab, ...newState } : tab
            ),
        }));
    },

    setEditorState: (id, editorState) => {
        set((state) => ({
            tabs: state.tabs.map((tab) =>
                tab.id === id ? { ...tab, editorState } : tab
            ),
        }));
    }
}));
