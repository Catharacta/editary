import React, { useState, useEffect } from 'react';
import { ChevronRight, ChevronDown, File, Folder, FolderOpen } from 'lucide-react';
import { readDir, DirectoryEntry, openFile, watchFile } from '../api';
import { useAppStore } from '../store';
import './FileTree.css';

interface FileTreeNodeProps {
    entry: DirectoryEntry;
    level: number;
}

const FileTreeNode: React.FC<FileTreeNodeProps> = ({ entry, level }) => {
    const { addTab, tabs, setActiveTab, expandedFolders, toggleFolder } = useAppStore();
    const isOpen = expandedFolders[entry.path] || false;
    const [children, setChildren] = useState<DirectoryEntry[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [hasLoaded, setHasLoaded] = useState(false);

    // Load children if open and not loaded
    useEffect(() => {
        if (isOpen && entry.is_dir && !hasLoaded && !isLoading) {
            const loadChildren = async () => {
                setIsLoading(true);
                try {
                    const entries = await readDir(entry.path);
                    setChildren(entries);
                    setHasLoaded(true);
                } catch (error) {
                    console.error('Failed to read dir:', error);
                } finally {
                    setIsLoading(false);
                }
            };
            loadChildren();
        }
    }, [isOpen, entry.path, entry.is_dir, hasLoaded, isLoading]);

    const handleToggle = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (entry.is_dir) {
            toggleFolder(entry.path);
        } else {
            // Open File
            const existing = tabs.find(t => t.path === entry.path);
            if (existing) {
                setActiveTab(existing.id);
            } else {
                try {
                    const result = await openFile(entry.path);
                    addTab(entry.path, result.content);
                    await watchFile(entry.path);
                } catch (error) {
                    console.error('Failed to open file:', error);
                }
            }
        }
    };

    return (
        <div className="file-tree-node">
            <div
                className="file-tree-item"
                style={{ paddingLeft: `${level * 16 + 8}px` }}
                onClick={handleToggle}
            >
                <span className="tree-toggle">
                    {entry.is_dir && (
                        isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />
                    )}
                </span>
                <span className="tree-icon">
                    {entry.is_dir ? (
                        isOpen ? <FolderOpen size={14} className="folder-icon" /> : <Folder size={14} className="folder-icon" />
                    ) : (
                        <File size={14} className="file-icon" />
                    )}
                </span>
                <span className="tree-label">{entry.name}</span>
            </div>
            {isOpen && entry.is_dir && (
                <div className="file-tree-children">
                    {isLoading ? (
                        <div className="tree-loading" style={{ paddingLeft: `${(level + 1) * 16 + 8}px` }}>Loading...</div>
                    ) : (
                        children.map(child => (
                            <FileTreeNode key={child.path} entry={child} level={level + 1} />
                        ))
                    )}
                </div>
            )}
        </div>
    );
};

interface FileTreeProps {
    rootPath: string;
}

const FileTree: React.FC<FileTreeProps> = ({ rootPath }) => {
    const [rootEntries, setRootEntries] = useState<DirectoryEntry[]>([]);

    useEffect(() => {
        const loadRoot = async () => {
            try {
                const entries = await readDir(rootPath);
                setRootEntries(entries);
            } catch (err) {
                console.error("Failed to load root:", err);
            }
        };
        loadRoot();
    }, [rootPath]);

    return (
        <div className="file-tree">
            {rootEntries.map(entry => (
                <FileTreeNode key={entry.path} entry={entry} level={0} />
            ))}
        </div>
    );
};

export default FileTree;
