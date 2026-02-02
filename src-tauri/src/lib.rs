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
    max_file_size: u64,
) -> Result<Vec<SearchResult>, String> {
    let mut results = Vec::new();

    // Configure WalkBuilder (respects .gitignore by default)
    let mut builder = WalkBuilder::new(&path);

    // Add default heavy directories and custom excludes to overrides
    let mut overrides = ignore::overrides::OverrideBuilder::new(&path);

    // Always exclude these heavy/build dirs if not already handled by gitignore
    // Negative patterns in OverrideBuilder mean "ignore this"
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

    // Add user provided excludes
    for e in excludes {
        if !e.trim().is_empty() {
            let _ = overrides.add(&format!("!**/{}/**", e.trim()));
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

                // 1. Check File Size (Skip > max_file_size)
                if let Ok(metadata) = entry.metadata() {
                    if metadata.len() > max_file_size {
                        continue;
                    }
                }

                // 2. Binary Check & Read
                if let Ok(file) = File::open(path_obj) {
                    let mut reader = BufReader::new(file);

                    let mut line_num = 1;

                    // Reader.lines() handles utf-8 checks implictly (returns error if not valid utf8)
                    for line_res in reader.lines() {
                        match line_res {
                            Ok(line) => {
                                // If line is extremely long, skip it or truncate?
                                if line.len() > 10000 {
                                    continue;
                                }

                                if line.contains(&query) {
                                    let line_content = line.trim();
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
                            Err(_) => {
                                // Likely binary or non-utf8, stop reading this file
                                break;
                            }
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
