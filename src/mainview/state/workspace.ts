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
    openTabs: new Map<string, TabState>(),
    untitledCount: 0,
    editor: null as unknown as Editor,
};
