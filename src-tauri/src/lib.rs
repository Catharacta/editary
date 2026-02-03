use chardetng::EncodingDetector;
use notify::{Event, EventKind, RecursiveMode, Watcher};
use serde::{Deserialize, Serialize};

use std::fs;
use std::sync::Mutex;
use std::time::SystemTime;
use tauri::{AppHandle, Emitter, State};

#[derive(Serialize, Deserialize)]
struct FileStat {
    path: String,
    last_modified: u64,
    size: u64,
}

#[derive(Serialize)]
struct FileContent {
    path: String,
    content: String,
    encoding: String,
    stat: FileStat,
}

struct WatcherState {
    watcher: Mutex<Option<notify::RecommendedWatcher>>,
}

#[tauri::command]
fn watch_file(app: AppHandle, state: State<'_, WatcherState>, path: String) -> Result<(), String> {
    let mut watcher_lock = state.watcher.lock().map_err(|e| e.to_string())?;

    if watcher_lock.is_none() {
        let app_handle = app.clone();
        let watcher =
            notify::recommended_watcher(move |res: Result<Event, notify::Error>| match res {
                Ok(event) => {
                    if let EventKind::Modify(_) = event.kind {
                        for path_buf in event.paths {
                            let path_str = path_buf.to_string_lossy().to_string();
                            let _ = app_handle.emit("file-changed", path_str);
                        }
                    }
                }
                Err(e) => println!("watch error: {:?}", e),
            })
            .map_err(|e| e.to_string())?;
        *watcher_lock = Some(watcher);
    }

    if let Some(watcher) = watcher_lock.as_mut() {
        let path_obj = std::path::Path::new(&path);
        if path_obj.exists() {
            let _ = watcher.watch(path_obj, RecursiveMode::NonRecursive);
        }
    }

    Ok(())
}

#[tauri::command]
fn unwatch_file(state: State<'_, WatcherState>, path: String) -> Result<(), String> {
    let mut watcher_lock = state.watcher.lock().map_err(|e| e.to_string())?;

    if let Some(watcher) = watcher_lock.as_mut() {
        let path_obj = std::path::Path::new(&path);
        let _ = watcher.unwatch(path_obj);
    }
    Ok(())
}

#[tauri::command]
fn open_file(path: String) -> Result<FileContent, String> {
    let bytes = fs::read(&path).map_err(|e| e.to_string())?;

    // Auto-detect encoding
    let mut detector = EncodingDetector::new();
    detector.feed(&bytes, true);
    let encoding = detector.guess(None, true);

    let (cow, _, _malformed) = encoding.decode(&bytes);
    let content = cow.into_owned();

    // Get file stats
    let metadata = fs::metadata(&path).map_err(|e| e.to_string())?;
    let last_modified = metadata
        .modified()
        .map_err(|e| e.to_string())?
        .duration_since(SystemTime::UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_millis() as u64;

    Ok(FileContent {
        path: path.clone(),
        content,
        encoding: encoding.name().to_string(),
        stat: FileStat {
            path,
            last_modified,
            size: metadata.len(),
        },
    })
}

#[tauri::command]
fn save_file(path: String, content: String) -> Result<FileStat, String> {
    fs::write(&path, &content).map_err(|e| e.to_string())?;

    let metadata = fs::metadata(&path).map_err(|e| e.to_string())?;
    let last_modified = metadata
        .modified()
        .map_err(|e| e.to_string())?
        .duration_since(SystemTime::UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_millis() as u64;

    Ok(FileStat {
        path,
        last_modified,
        size: metadata.len(),
    })
}

#[derive(Serialize)]
struct DirectoryEntry {
    name: String,
    path: String,
    is_dir: bool,
}

#[tauri::command]
fn read_dir(path: String) -> Result<Vec<DirectoryEntry>, String> {
    let mut entries = Vec::new();
    let read_dir = fs::read_dir(&path).map_err(|e| e.to_string())?;

    for entry in read_dir {
        if let Ok(entry) = entry {
            let file_type = entry.file_type().map_err(|e| e.to_string())?;
            let path_buf = entry.path();
            let name = entry.file_name().to_string_lossy().to_string();

            entries.push(DirectoryEntry {
                name,
                path: path_buf.to_string_lossy().to_string(),
                is_dir: file_type.is_dir(),
            });
        }
    }

    // Sort: directories first, then files (alphabetical)
    entries.sort_by(|a, b| {
        if a.is_dir == b.is_dir {
            a.name.to_lowercase().cmp(&b.name.to_lowercase())
        } else {
            if a.is_dir {
                std::cmp::Ordering::Less
            } else {
                std::cmp::Ordering::Greater
            }
        }
    });

    Ok(entries)
}

#[derive(Serialize)]
struct SearchResult {
    file_path: String,
    line_number: usize,
    line_content: String,
}

#[derive(Serialize)]
struct MatchPreview {
    line: usize,
    original: String,
    replacement: String,
}

#[derive(Serialize)]
struct ReplaceResult {
    file_path: String,
    matches: Vec<MatchPreview>,
    replaced_count: usize,
}

use ignore::WalkBuilder;
use std::fs::File;
use std::io::{BufRead, BufReader};

#[tauri::command]
fn search_files(
    query: String,
    path: String,
    excludes: Vec<String>,
    includes: Vec<String>,
    max_file_size: u64,
    case_sensitive: bool,
    whole_word: bool,
    is_regex: bool,
    additional_paths: Vec<String>,
) -> Result<Vec<SearchResult>, String> {
    let mut results = Vec::new();

    // 0. Prepare Regex Pattern
    let pattern = if is_regex {
        query.clone()
    } else {
        regex::escape(&query)
    };

    let final_pattern = if whole_word {
        format!(r"\b{}\b", pattern)
    } else {
        pattern
    };

    let re = regex::RegexBuilder::new(&final_pattern)
        .case_insensitive(!case_sensitive)
        .build()
        .map_err(|e| format!("Invalid regex: {}", e))?;

    // Helper function to search a single file
    let search_file = |file_path: &std::path::Path,
                       re: &regex::Regex,
                       results: &mut Vec<SearchResult>,
                       max_size: u64| {
        if let Ok(metadata) = std::fs::metadata(file_path) {
            if metadata.len() > max_size {
                return;
            }
        }

        if let Ok(file) = File::open(file_path) {
            let mut reader = BufReader::new(file);
            let mut line_num = 1;
            let mut buf = String::new();

            loop {
                buf.clear();
                match reader.read_line(&mut buf) {
                    Ok(0) => break,
                    Ok(_) => {
                        if buf.contains('\0') {
                            break;
                        }
                        if buf.len() > 10000 {
                            line_num += 1;
                            continue;
                        }

                        let line_str = buf.trim_end();
                        if re.is_match(line_str) {
                            let line_content = line_str.trim();
                            let display_content = if line_content.len() > 100 {
                                format!("{}...", &line_content[0..100])
                            } else {
                                line_content.to_string()
                            };

                            results.push(SearchResult {
                                file_path: file_path.to_string_lossy().to_string(),
                                line_number: line_num,
                                line_content: display_content,
                            });

                            if results.len() >= 500 {
                                return;
                            }
                        }
                    }
                    Err(_) => break,
                }
                line_num += 1;
            }
        }
    };

    // Track searched paths to avoid duplicates
    let mut searched_paths: std::collections::HashSet<String> = std::collections::HashSet::new();

    // 1. Search project directory (if path is not empty)
    if !path.is_empty() {
        let mut builder = WalkBuilder::new(&path);
        let mut overrides = ignore::overrides::OverrideBuilder::new(&path);

        // Default heavy exclusions
        for e in &[
            "node_modules",
            ".git",
            "target",
            "dist",
            "build",
            ".idea",
            ".vscode",
        ] {
            let _ = overrides.add(&format!("!**/{}/**", e));
        }

        // Custom excludes (negative patterns)
        for e in &excludes {
            if !e.trim().is_empty() {
                let _ = overrides.add(&format!("!**/{}/**", e.trim()));
            }
        }

        // Custom includes (positive patterns)
        for i in &includes {
            if !i.trim().is_empty() {
                let _ = overrides.add(&format!("**/{}", i.trim()));
            }
        }

        if let Ok(ov) = overrides.build() {
            builder.overrides(ov);
        }

        let walker = builder.build();

        for result in walker {
            match result {
                Ok(entry) => {
                    if !entry.file_type().map(|ft| ft.is_file()).unwrap_or(false) {
                        continue;
                    }

                    let path_obj = entry.path();
                    let path_str = path_obj.to_string_lossy().to_string();

                    // Check File Size
                    if let Ok(metadata) = entry.metadata() {
                        if metadata.len() > max_file_size {
                            continue;
                        }
                    }

                    // Mark as searched
                    searched_paths.insert(path_str.clone());

                    search_file(path_obj, &re, &mut results, max_file_size);

                    if results.len() >= 500 {
                        return Ok(results);
                    }
                }
                Err(_) => continue,
            }
        }
    }

    // 2. Search additional paths (open files not in project)
    for additional_path in additional_paths {
        // Normalize path for comparison
        let normalized = additional_path.replace("/", "\\");

        // Skip if already searched (file is inside project)
        if searched_paths.contains(&normalized) || searched_paths.contains(&additional_path) {
            continue;
        }

        let path_obj = std::path::Path::new(&additional_path);
        if path_obj.exists() && path_obj.is_file() {
            search_file(path_obj, &re, &mut results, max_file_size);

            if results.len() >= 500 {
                return Ok(results);
            }
        }
    }

    Ok(results)
}

#[tauri::command]
fn replace_files(
    query: String,
    replacement: String,
    path: String,
    excludes: Vec<String>,
    includes: Vec<String>,
    max_file_size: u64,
    case_sensitive: bool,
    whole_word: bool,
    is_regex: bool,
    dry_run: bool,
    additional_paths: Vec<String>,
) -> Result<Vec<ReplaceResult>, String> {
    let mut results = Vec::new();

    // 0. Prepare Regex Pattern
    let pattern = if is_regex {
        query.clone()
    } else {
        regex::escape(&query)
    };

    let final_pattern = if whole_word {
        format!(r"\b{}\b", pattern)
    } else {
        pattern
    };

    let re = regex::RegexBuilder::new(&final_pattern)
        .case_insensitive(!case_sensitive)
        .build()
        .map_err(|e| format!("Invalid regex: {}", e))?;

    // Helper function to process a single file for replacement
    let process_file = |path_obj: &std::path::Path,
                        re: &regex::Regex,
                        replacement: &str,
                        dry_run: bool,
                        results: &mut Vec<ReplaceResult>|
     -> Result<(), String> {
        if let Ok(content) = fs::read_to_string(path_obj) {
            if !re.is_match(&content) {
                return Ok(());
            }

            if dry_run {
                let mut matches = Vec::new();
                let mut line_num = 1;
                for line in content.lines() {
                    if re.is_match(line) {
                        let replaced_line = re.replace_all(line, replacement);
                        matches.push(MatchPreview {
                            line: line_num,
                            original: line.trim().to_string(),
                            replacement: replaced_line.trim().to_string(),
                        });
                    }
                    line_num += 1;
                }

                if !matches.is_empty() {
                    results.push(ReplaceResult {
                        file_path: path_obj.to_string_lossy().to_string(),
                        replaced_count: matches.len(),
                        matches,
                    });
                }
            } else {
                let new_content = re.replace_all(&content, replacement);
                if let std::borrow::Cow::Owned(owned_content) = new_content {
                    if let Err(e) = fs::write(path_obj, owned_content) {
                        return Err(format!(
                            "Failed to write file {}: {}",
                            path_obj.display(),
                            e
                        ));
                    }
                    results.push(ReplaceResult {
                        file_path: path_obj.to_string_lossy().to_string(),
                        matches: vec![],
                        replaced_count: 1,
                    });
                }
            }
        }
        Ok(())
    };

    // Track processed paths to avoid duplicates
    let mut processed_paths: std::collections::HashSet<String> = std::collections::HashSet::new();

    // 1. Process project directory (if path is not empty)
    if !path.is_empty() {
        let mut builder = WalkBuilder::new(&path);
        let mut overrides = ignore::overrides::OverrideBuilder::new(&path);

        // Default exclusions
        for e in &[
            "node_modules",
            ".git",
            "target",
            "dist",
            "build",
            ".idea",
            ".vscode",
        ] {
            let _ = overrides.add(&format!("!**/{}/**", e));
        }

        // Custom excludes
        for e in &excludes {
            if !e.trim().is_empty() {
                let _ = overrides.add(&format!("!**/{}/**", e.trim()));
            }
        }

        // Custom includes
        for i in &includes {
            if !i.trim().is_empty() {
                let _ = overrides.add(&format!("**/{}", i.trim()));
            }
        }

        if let Ok(ov) = overrides.build() {
            builder.overrides(ov);
        }

        let walker = builder.build();

        for result in walker {
            match result {
                Ok(entry) => {
                    if !entry.file_type().map(|ft| ft.is_file()).unwrap_or(false) {
                        continue;
                    }

                    let path_obj = entry.path();
                    let path_str = path_obj.to_string_lossy().to_string();

                    if let Ok(metadata) = entry.metadata() {
                        if metadata.len() > max_file_size {
                            continue;
                        }
                    }

                    processed_paths.insert(path_str.clone());
                    process_file(path_obj, &re, &replacement, dry_run, &mut results)?;
                }
                Err(_) => continue,
            }
        }
    }

    // 2. Process additional paths (open files not in project)
    for additional_path in additional_paths {
        let normalized = additional_path.replace("/", "\\");

        if processed_paths.contains(&normalized) || processed_paths.contains(&additional_path) {
            continue;
        }

        let path_obj = std::path::Path::new(&additional_path);
        if path_obj.exists() && path_obj.is_file() {
            if let Ok(metadata) = std::fs::metadata(path_obj) {
                if metadata.len() <= max_file_size {
                    process_file(path_obj, &re, &replacement, dry_run, &mut results)?;
                }
            }
        }
    }

    Ok(results)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .manage(WatcherState {
            watcher: Mutex::new(None),
        })
        .invoke_handler(tauri::generate_handler![
            open_file,
            save_file,
            watch_file,
            unwatch_file,
            read_dir,
            search_files,
            replace_files
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
