import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { EditorState } from '@codemirror/state';

export interface Tab {
    id: string;
    path: string | null; // null for new untitled files
    displayName: string;
    content: string; // Text content
    isDirty: boolean;
    contentVersion: number; // 0 for initial, increment on external reload
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
    reloadTabContent: (id: string, content: string) => void;
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

        const newTab: Tab = {
            id,
            path: path ?? null,
            displayName,
            content,
            isDirty: false,
            contentVersion: 0,
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
                newActiveId = newTabs.length > 0 ? newTabs[newTabs.length - 1].id : null;
            }

            return {
                tabs: newTabs,
                activeTabId: newActiveId,
            };
        });
    },

    setActiveTab: (id) => set({ activeTabId: id }),

    updateTabContent: (id, content, isDirty = true) => {
        set((state) => ({
            tabs: state.tabs.map((t) =>
                t.id === id ? { ...t, content, isDirty } : t
            ),
        }));
    },

    reloadTabContent: (id, content) => {
        set((state) => ({
            tabs: state.tabs.map((t) =>
                t.id === id ? { ...t, content, isDirty: false, contentVersion: t.contentVersion + 1 } : t
            ),
        }));
    },

    updateTabState: (id, newState) => {
        set((state) => ({
            tabs: state.tabs.map((t) =>
                t.id === id ? { ...t, ...newState } : t
            ),
        }));
    },

    setEditorState: (id, editorState) => {
        set((state) => ({
            tabs: state.tabs.map((t) =>
                t.id === id ? { ...t, editorState } : t
            ),
        }));
    },
}));
