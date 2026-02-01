use chardetng::EncodingDetector;
use serde::{Deserialize, Serialize};
use std::fs;
use std::time::SystemTime;

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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![open_file, save_file])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
