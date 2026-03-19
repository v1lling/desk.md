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

#[tauri::command]
pub fn desk_create_task(
    workspace_id: String,
    project_id: String,
    title: String,
    status: Option<String>,
    priority: Option<String>,
    due: Option<String>,
    content: Option<String>,
) -> Result<desk_commands::MutationResult, String> {
    desk_commands::desk_create_task(workspace_id, project_id, title, status, priority, due, content)
}

#[tauri::command]
pub fn desk_update_task(
    workspace_id: String,
    task_id: String,
    project_id: Option<String>,
    title: Option<String>,
    status: Option<String>,
    priority: Option<String>,
    due: Option<String>,
    content: Option<String>,
) -> Result<desk_commands::MutationResult, String> {
    desk_commands::desk_update_task(
        workspace_id,
        task_id,
        project_id,
        title,
        status,
        priority,
        due,
        content,
    )
}

#[tauri::command]
pub fn desk_create_meeting(
    workspace_id: String,
    project_id: String,
    title: String,
    date: Option<String>,
    content: Option<String>,
) -> Result<desk_commands::MutationResult, String> {
    desk_commands::desk_create_meeting(workspace_id, project_id, title, date, content)
}

#[tauri::command]
pub fn desk_update_meeting(
    workspace_id: String,
    meeting_id: String,
    project_id: Option<String>,
    title: Option<String>,
    date: Option<String>,
    attendees: Option<Vec<String>>,
    content: Option<String>,
) -> Result<desk_commands::MutationResult, String> {
    desk_commands::desk_update_meeting(
        workspace_id,
        meeting_id,
        project_id,
        title,
        date,
        attendees,
        content,
    )
}

#[tauri::command]
pub fn desk_create_doc(
    workspace_id: String,
    project_id: Option<String>,
    title: String,
    content: Option<String>,
) -> Result<desk_commands::MutationResult, String> {
    desk_commands::desk_create_doc(workspace_id, project_id, title, content)
}

#[tauri::command]
pub fn desk_update_doc(
    workspace_id: String,
    doc_id: String,
    project_id: Option<String>,
    title: Option<String>,
    content: Option<String>,
) -> Result<desk_commands::MutationResult, String> {
    desk_commands::desk_update_doc(workspace_id, doc_id, project_id, title, content)
}
