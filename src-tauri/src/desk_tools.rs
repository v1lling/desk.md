use crate::desk_commands;

#[tauri::command]
pub fn desk_tree(workspace_id: Option<String>, path: Option<String>) -> Result<desk_commands::DeskTreeResult, String> {
    desk_commands::desk_tree(workspace_id, path)
}

#[tauri::command]
pub fn desk_read(path: String) -> Result<desk_commands::DeskReadResult, String> {
    desk_commands::desk_read(path)
}

#[tauri::command]
pub fn desk_search(
    query: String,
    path: Option<String>,
) -> Result<desk_commands::DeskSearchResult, String> {
    desk_commands::desk_search(query, path)
}

#[tauri::command]
pub fn desk_workspace_info(
    workspace_id: Option<String>,
) -> Result<desk_commands::DeskWorkspaceInfoResult, String> {
    desk_commands::desk_workspace_info(workspace_id)
}
