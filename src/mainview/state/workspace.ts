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
    openTabs: new Map<string, TabState>(),
    untitledCount: 0,
    editor: null as unknown as Editor,
    editorSettings: {
        autoSave: false,
        showLineNumbers: false,
    },
};
