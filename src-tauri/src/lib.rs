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

    // 1. Configure WalkBuilder (respects .gitignore by default)
    let mut builder = WalkBuilder::new(&path);

    // 2. Overrides (Excludes & Includes)
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
    for e in excludes {
        if !e.trim().is_empty() {
            let _ = overrides.add(&format!("!**/{}/**", e.trim()));
        }
    }

    // Custom includes (positive patterns)
    // Note: If includes are specified, we might want to ONLY search them?
    // ripgrep behavior: glob patterns act as filters.
    // If we add "src/*.ts", it filters FOR that.
    for i in includes {
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

                // Check File Size
                if let Ok(metadata) = entry.metadata() {
                    if metadata.len() > max_file_size {
                        continue;
                    }
                }

                // Read and Search
                if let Ok(file) = File::open(path_obj) {
                    let mut reader = BufReader::new(file);
                    let mut line_num = 1;
                    let mut buf = String::new();

                    loop {
                        buf.clear();
                        // limit execution time?

                        match reader.read_line(&mut buf) {
                            Ok(0) => break, // EOF
                            Ok(_) => {
                                // Check for null byte -> binary -> skip file
                                if buf.contains('\0') {
                                    break;
                                }

                                // Skip super long lines to prevent regex DoS/hanging
                                if buf.len() > 10000 {
                                    line_num += 1;
                                    continue;
                                }

                                // Trim newline for matching? Regex might want it, but usually standard is line-based.
                                let line_str = buf.trim_end();

                                if re.is_match(line_str) {
                                    let line_content = line_str.trim();
                                    let display_content = if line_content.len() > 100 {
                                        format!("{}...", &line_content[0..100])
                                    } else {
                                        line_content.to_string()
                                    };

                                    results.push(SearchResult {
                                        file_path: path_obj.to_string_lossy().to_string(),
                                        line_number: line_num,
                                        line_content: display_content,
                                    });

                                    if results.len() >= 500 {
                                        return Ok(results);
                                    }
                                }
                            }
                            Err(_) => break, // Error (non-utf8 etc)
                        }
                        line_num += 1;
                    }
                }
            }
            Err(_) => continue,
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
            search_files
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
