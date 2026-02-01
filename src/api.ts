import { invoke } from '@tauri-apps/api/core';

export interface FileStat {
    path: string;
    last_modified: number;
    size: number;
}

export interface FileContent {
    path: string;
    content: string;
    encoding: string;
    stat: FileStat;
}

/**
 * Open a file via Rust backend command.
 * Auto-detects encoding and returns content as UTF-8 string.
 */
export async function openFile(path: string): Promise<FileContent> {
    return invoke<FileContent>('open_file', { path });
}

/**
 * Save content to a file.
 * Currently writes as UTF-8.
 */
export async function saveFile(path: string, content: string): Promise<FileStat> {
    return invoke<FileStat>('save_file', { path, content });
}

export async function watchFile(path: string): Promise<void> {
    return invoke('watch_file', { path });
}

export async function unwatchFile(path: string): Promise<void> {
    return invoke('unwatch_file', { path });
}
