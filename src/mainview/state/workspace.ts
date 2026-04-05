import { Editor } from "@tiptap/core";

export type TabState = {
    filePath: string;
    isDirty: boolean;
    isUntitled?: boolean;
    cachedContent?: string;
};

export const state = {
    currentFilePath: null as string | null,
    currentFolderPath: null as string | null,
    selectedPath: null as string | null, // Currently selected item (file or folder) in the tree
    expandedPaths: new Set<string>(), // Paths of folders currently expanded
    openTabs: new Map<string, TabState>(),
    untitledCount: 0,
    editor: null as Editor | null,
    activeSidebarTab: 'explorer' as 'explorer' | 'search',
    searchResults: [] as any[],
    editorSettings: {
        autoSave: false,
        showLineNumbers: false,
        language: 'ja' as 'ja' | 'en',
    },
};
