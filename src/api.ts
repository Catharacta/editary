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

export interface DirectoryEntry {
    name: string;
    path: string;
    is_dir: boolean;
}

export async function readDir(path: string): Promise<DirectoryEntry[]> {
    return invoke<DirectoryEntry[]>('read_dir', { path });
}

export interface SearchResult {
    file_path: string;
    line_number: number;
    line_content: string;
}

export async function searchFiles(
    query: String,
    path: String,
    excludes: string[],
    includes: string[],
    max_file_size: number,
    case_sensitive: boolean,
    whole_word: boolean,
    is_regex: boolean,
    additional_paths: string[] = []
): Promise<SearchResult[]> {
    return invoke<SearchResult[]>('search_files', {
        query,
        path,
        excludes,
        includes,
        maxFileSize: max_file_size,
        caseSensitive: case_sensitive,
        wholeWord: whole_word,
        isRegex: is_regex,
        additionalPaths: additional_paths
    });
}

export interface MatchPreview {
    line: number;
    original: string;
    replacement: string;
}

export interface ReplaceResult {
    file_path: string;
    matches: MatchPreview[];
    replaced_count: number;
}

export async function replaceFiles(
    query: string,
    replacement: string,
    path: string,
    excludes: string[],
    includes: string[],
    max_file_size: number,
    case_sensitive: boolean,
    whole_word: boolean,
    is_regex: boolean,
    dry_run: boolean,
    additional_paths: string[] = []
): Promise<ReplaceResult[]> {
    return invoke<ReplaceResult[]>('replace_files', {
        query,
        replacement,
        path,
        excludes,
        includes,
        maxFileSize: max_file_size,
        caseSensitive: case_sensitive,
        wholeWord: whole_word,
        isRegex: is_regex,
        dryRun: dry_run,
        additionalPaths: additional_paths
    });
}
