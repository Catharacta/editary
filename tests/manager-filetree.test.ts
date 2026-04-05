import { expect, test, describe, beforeEach, spyOn, mock } from "bun:test";
import "./setup";
import { FileTreeManager } from "../src/mainview/workspace/FileTreeManager";
import { state } from "../src/mainview/state/workspace";

// Mock electroview RPC
const mockReadDir = mock(async ({ dirPath, recursive }: any) => {
    if (dirPath === "/root") {
        return [
            { name: "folder1", path: "/root/folder1", isDirectory: true },
            { name: "file1.md", path: "/root/file1.md", isDirectory: false },
        ];
    } else if (dirPath === "/root/folder1") {
        return [
            { name: "subfile.md", path: "/root/folder1/subfile.md", isDirectory: false },
        ];
    }
    return [];
});

mock.module("../src/mainview/ipc", () => ({
    electroview: {
        rpc: {
            request: {
                readDirectory: mockReadDir
            }
        }
    }
}));

describe("FileTreeManager", () => {
    beforeEach(() => {
        document.body.innerHTML = `
            <div id="fileTree"></div>
        `;
        state.currentFolderPath = "/root";
        state.expandedPaths = new Set();
        state.selectedPath = null;
    });

    test("load should fetch and render root entries", async () => {
        await FileTreeManager.load("/root");
        
        const tree = document.getElementById("fileTree");
        expect(tree?.children.length).toBe(3); // folder1, folder1's childrenContainer, file1.md
        
        const folder1 = tree?.querySelector('[data-path="/root/folder1"]');
        expect(folder1).toBeDefined();
        expect(folder1?.classList.contains("file-tree-item--directory")).toBe(true);
    });

    test("toggleFolder should expand and lazy load", async () => {
        await FileTreeManager.load("/root");
        
        const folderPath = "/root/folder1";
        const folderItem = document.querySelector(`[data-path="${folderPath}"]`) as HTMLElement;
        expect(folderItem).toBeDefined();
        
        // Initial state: collapsed
        expect(state.expandedPaths.has(folderPath)).toBe(false);
        
        // Toggle (Expand)
        await FileTreeManager.toggleFolder(folderPath);
        expect(state.expandedPaths.has(folderPath)).toBe(true);
        expect(folderItem.classList.contains("expanded")).toBe(true);
        
        // Check if children were loaded
        const container = document.querySelector(`[data-path="${folderPath}"] + .file-tree-children`);
        expect(container?.children.length).toBe(1);
        expect(container?.innerHTML).toContain("subfile.md");
        
        // Toggle (Collapse)
        await FileTreeManager.toggleFolder(folderPath);
        expect(state.expandedPaths.has(folderPath)).toBe(false);
        expect(folderItem.classList.contains("collapsed")).toBe(true);
    });

    test("selectItem should update state and highlight UI", async () => {
        await FileTreeManager.load("/root");
        const filePath = "/root/file1.md";
        
        FileTreeManager.selectItem(filePath);
        expect(state.selectedPath).toBe(filePath);
        
        const item = document.querySelector(`[data-path="${filePath}"]`);
        expect(item?.classList.contains("file-tree-item--selected")).toBe(true);
    });
});
