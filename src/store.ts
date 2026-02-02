import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { EditorState } from '@codemirror/state';

export type PaneId = 'primary' | 'secondary';

export interface PaneState {
    id: PaneId;
    activeTabId: string | null;
    // History stack could go here later
}

export interface Tab {
    id: string;
    path: string | null; // null for new untitled files
    displayName: string;
    content: string; // Text content
    isDirty: boolean;
    contentVersion: number; // 0 for initial, increment on external reload
    internalContentVersion: number; // Increment on internal edits for sync
    editorState?: EditorState;
    type: 'editor' | 'settings';
}

export interface CursorPos {
    line: number;
    col: number;
}

interface AppState {
    tabs: Tab[];
    // Split View State
    panes: Record<PaneId, PaneState>;
    activePaneId: PaneId;
    isSplit: boolean;

    theme: 'dark' | 'light';
    cursorPos: CursorPos;

    // Project State
    projectRoot: string | null;
    expandedFolders: Record<string, boolean>;
    activeSidebarView: 'explorer' | 'search';
    searchExcludes: string[];
    searchIncludes: string[]; // New
    searchMaxFileSize: number;
    searchCaseSensitive: boolean; // New
    searchWholeWord: boolean; // New
    searchRegex: boolean; // New

    // Actions
    addTab: (path?: string, content?: string, type?: 'editor' | 'settings') => string;
    closeTab: (id: string, paneId?: PaneId) => void;
    setActiveTab: (id: string) => void;
    updateTabContent: (id: string, content: string, isDirty?: boolean) => void;
    reloadTabContent: (id: string, content: string) => void;
    updateTabState: (id: string, newState: Partial<Tab>) => void;
    setEditorState: (id: string, state: EditorState) => void;
    setTheme: (theme: 'dark' | 'light') => void;
    setCursorPos: (pos: CursorPos) => void;

    // Split View Actions
    enableSplit: () => void;
    disableSplit: () => void;
    setActivePane: (paneId: PaneId) => void;

    // Project Actions
    openProject: (path: string) => void;
    closeProject: () => void;
    toggleFolder: (path: string) => void;
    setFolderExpanded: (path: string, expanded: boolean) => void;
    setActiveSidebarView: (view: 'explorer' | 'search') => void;
    setSearchExcludes: (excludes: string[]) => void;
    setSearchIncludes: (includes: string[]) => void; // New
    setSearchMaxFileSize: (size: number) => void;
    setSearchCaseSensitive: (val: boolean) => void; // New
    setSearchWholeWord: (val: boolean) => void; // New
    setSearchRegex: (val: boolean) => void; // New
}

export const useAppStore = create<AppState>((set, _get) => ({
    tabs: [],
    panes: {
        primary: { id: 'primary', activeTabId: null },
        secondary: { id: 'secondary', activeTabId: null },
    },
    activePaneId: 'primary',
    isSplit: false,
    theme: 'dark',
    cursorPos: { line: 1, col: 1 },
    projectRoot: null,
    expandedFolders: {},
    activeSidebarView: 'explorer',
    searchExcludes: ['dist', 'build', 'out'],
    searchIncludes: [],
    searchMaxFileSize: 1024 * 1024,
    searchCaseSensitive: false,
    searchWholeWord: false,
    searchRegex: false,

    setTheme: (theme) => set({ theme }),
    setCursorPos: (pos) => set({ cursorPos: pos }),

    addTab: (path = undefined, content = '', type = 'editor') => {
        const id = uuidv4();
        let displayName = 'Untitled-1';

        if (type === 'settings') {
            displayName = 'Settings';
            path = 'editary://settings';
        } else if (path) {
            displayName = path.split(/[\\/]/).pop() || 'Unknown';
        } else {
            // Generate Untitled-N
            const untitledTabs = useAppStore.getState().tabs
                .filter(t => !t.path && t.displayName.startsWith('Untitled-'))
                .map(t => {
                    const match = t.displayName.match(/Untitled-(\d+)/);
                    return match ? parseInt(match[1], 10) : 0;
                });

            let n = 1;
            while (untitledTabs.includes(n)) {
                n++;
            }
            displayName = `Untitled-${n}`;
        }

        const newTab: Tab = {
            id,
            path: path ?? null,
            displayName,
            content,
            isDirty: false,
            contentVersion: 0,
            internalContentVersion: 0,
            type,
        };

        set((state) => {
            const activePane = state.panes[state.activePaneId];
            return {
                tabs: [...state.tabs, newTab],
                panes: {
                    ...state.panes,
                    [state.activePaneId]: {
                        ...activePane,
                        activeTabId: id
                    }
                }
            };
        });

        return id;
    },

    closeTab: (id, _targetPaneId) => {
        set((state) => {
            const newTabs = state.tabs.filter((t) => t.id !== id);

            // Function to calculate new active ID for a specific pane
            const getNewActiveId = (currentActiveId: string | null) => {
                if (currentActiveId === id) {
                    return newTabs.length > 0 ? newTabs[newTabs.length - 1].id : null;
                }
                return currentActiveId;
            };

            // Update all panes that might have this tab active
            const newPanes = { ...state.panes };

            (['primary', 'secondary'] as PaneId[]).forEach(paneId => {
                const pane = newPanes[paneId];
                if (pane.activeTabId === id) {
                    newPanes[paneId] = {
                        ...pane,
                        activeTabId: getNewActiveId(pane.activeTabId)
                    };
                }
            });

            return {
                tabs: newTabs,
                panes: newPanes,
            };
        });
    },

    setActiveTab: (id) => set((state) => ({
        panes: {
            ...state.panes,
            [state.activePaneId]: {
                ...state.panes[state.activePaneId],
                activeTabId: id
            }
        }
    })),

    updateTabContent: (id, content, isDirty = true) => {
        set((state) => ({
            tabs: state.tabs.map((t) =>
                t.id === id ? { ...t, content, isDirty, internalContentVersion: t.internalContentVersion + 1 } : t
            ),
        }));
    },

    reloadTabContent: (id, content) => {
        set((state) => ({
            tabs: state.tabs.map((t) =>
                t.id === id ? {
                    ...t,
                    content,
                    isDirty: false,
                    contentVersion: t.contentVersion + 1,
                    internalContentVersion: t.internalContentVersion + 1
                } : t
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

    // Split View Actions
    enableSplit: () => set((state) => {
        if (state.isSplit) return {}; // Already split

        return {
            isSplit: true,
            panes: {
                ...state.panes,
                secondary: {
                    ...state.panes.secondary,
                    activeTabId: state.panes.primary.activeTabId
                }
            },
            activePaneId: 'secondary' // Focus new pane
        };
    }),

    disableSplit: () => set((_state) => ({
        isSplit: false,
        activePaneId: 'primary'
    })),

    setActivePane: (paneId) => set({ activePaneId: paneId }),

    openProject: (path) => set({ projectRoot: path, expandedFolders: {} }),
    closeProject: () => set({ projectRoot: null, expandedFolders: {} }),

    toggleFolder: (path) => set((state) => ({
        expandedFolders: {
            ...state.expandedFolders,
            [path]: !state.expandedFolders[path]
        }
    })),

    setFolderExpanded: (path, expanded) => set((state) => ({
        expandedFolders: {
            ...state.expandedFolders,
            [path]: expanded
        }
    })),

    setActiveSidebarView: (view) => set({ activeSidebarView: view }),
    setSearchExcludes: (excludes) => set({ searchExcludes: excludes }),
    setSearchIncludes: (includes) => set({ searchIncludes: includes }),
    setSearchMaxFileSize: (size) => set({ searchMaxFileSize: size }),
    setSearchCaseSensitive: (val) => set({ searchCaseSensitive: val }),
    setSearchWholeWord: (val) => set({ searchWholeWord: val }),
    setSearchRegex: (val) => set({ searchRegex: val }),
}));
