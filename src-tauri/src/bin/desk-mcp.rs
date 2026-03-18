use app_lib::mcp_core;
use serde::Serialize;
use serde_json::{json, Value};
use std::io::{self, BufRead, Write};
use std::path::PathBuf;

#[derive(Serialize)]
struct ToolDef {
    name: &'static str,
    description: &'static str,
    #[serde(rename = "inputSchema")]
    input_schema: Value,
}

fn tool_definitions() -> Vec<ToolDef> {
    vec![
        ToolDef {
            name: "desk_tree",
            description: "Get the workspace file tree. Returns ALL files and directories as a flat list with workspace-relative paths (usable with desk_read). Also returns project ID-to-name mappings. Without a path argument this returns the complete tree — if truncated is false, you have everything; do NOT re-call for subdirectories. Only use path to drill into a subdirectory when the full tree was truncated.",
            input_schema: json!({
              "type": "object",
              "properties": {
                "workspace_id": { "type": "string" },
                "path": { "type": "string", "description": "Optional subdirectory to scope the tree to (workspace-relative)." }
              }
            }),
        },
        ToolDef {
            name: "desk_read",
            description: "Read a UTF-8 text file relative to Desk data root.",
            input_schema: json!({
              "type": "object",
              "required": ["path"],
              "properties": {
                "path": { "type": "string" }
              }
            }),
        },
        ToolDef {
            name: "desk_search",
            description: "Search text content under Desk data root.",
            input_schema: json!({
              "type": "object",
              "required": ["query"],
              "properties": {
                "query": { "type": "string" },
                "path": { "type": "string" }
              }
            }),
        },
        ToolDef {
            name: "desk_workspace_info",
            description: "List workspace and project metadata.",
            input_schema: json!({
              "type": "object",
              "properties": {
                "workspace_id": { "type": "string" }
              }
            }),
        },
        ToolDef {
            name: "desk_create_task",
            description: "Create a task in a workspace project.",
            input_schema: json!({
              "type": "object",
              "required": ["workspace_id", "project_id", "title"],
              "properties": {
                "workspace_id": { "type": "string" },
                "project_id": { "type": "string" },
                "title": { "type": "string" },
                "status": { "type": "string" },
                "priority": { "type": "string" },
                "due": { "type": "string" },
                "content": { "type": "string" }
              }
            }),
        },
        ToolDef {
            name: "desk_update_task",
            description: "Update an existing task.",
            input_schema: json!({
              "type": "object",
              "required": ["workspace_id", "task_id"],
              "properties": {
                "workspace_id": { "type": "string" },
                "task_id": { "type": "string" },
                "project_id": { "type": "string" },
                "title": { "type": "string" },
                "status": { "type": "string" },
                "priority": { "type": "string" },
                "due": { "type": "string" },
                "content": { "type": "string" }
              }
            }),
        },
        ToolDef {
            name: "desk_create_meeting",
            description: "Create a meeting note.",
            input_schema: json!({
              "type": "object",
              "required": ["workspace_id", "project_id", "title"],
              "properties": {
                "workspace_id": { "type": "string" },
                "project_id": { "type": "string" },
                "title": { "type": "string" },
                "date": { "type": "string" },
                "content": { "type": "string" }
              }
            }),
        },
        ToolDef {
            name: "desk_update_meeting",
            description: "Update an existing meeting note.",
            input_schema: json!({
              "type": "object",
              "required": ["workspace_id", "meeting_id"],
              "properties": {
                "workspace_id": { "type": "string" },
                "meeting_id": { "type": "string" },
                "project_id": { "type": "string" },
                "title": { "type": "string" },
                "date": { "type": "string" },
                "attendees": { "type": "array", "items": { "type": "string" } },
                "content": { "type": "string" }
              }
            }),
        },
        ToolDef {
            name: "desk_create_doc",
            description: "Create a document in workspace or project scope.",
            input_schema: json!({
              "type": "object",
              "required": ["workspace_id", "title"],
              "properties": {
                "workspace_id": { "type": "string" },
                "project_id": { "type": "string" },
                "title": { "type": "string" },
                "content": { "type": "string" }
              }
            }),
        },
        ToolDef {
            name: "desk_update_doc",
            description: "Update an existing document.",
            input_schema: json!({
              "type": "object",
              "required": ["workspace_id", "doc_id"],
              "properties": {
                "workspace_id": { "type": "string" },
                "doc_id": { "type": "string" },
                "project_id": { "type": "string" },
                "title": { "type": "string" },
                "content": { "type": "string" }
              }
            }),
        },
    ]
}

fn parse_args() -> Result<(Option<PathBuf>, bool), String> {
    let mut data_root: Option<PathBuf> = None;
    let mut self_test = false;
    let mut args = std::env::args().skip(1);

    while let Some(arg) = args.next() {
        match arg.as_str() {
            "--data-root" => {
                let value = args
                    .next()
                    .ok_or_else(|| "--data-root requires a value".to_string())?;
                data_root = Some(PathBuf::from(value));
            }
            "--self-test" => {
                self_test = true;
            }
            // Some MCP clients may pass extra transport/runtime args.
            // Ignore unknown args so server startup remains compatible.
            _ => {}
        }
    }

    Ok((data_root, self_test))
}

fn success_call_result(value: Value) -> Value {
    json!({
      "content": [
        {
          "type": "text",
          "text": serde_json::to_string_pretty(&value).unwrap_or_else(|_| "{}".to_string())
        }
      ],
      "isError": false
    })
}

fn error_call_result(message: &str) -> Value {
    json!({
      "content": [
        {
          "type": "text",
          "text": message
        }
      ],
      "isError": true
    })
}

fn handle_tool_call(name: &str, arguments: &Value) -> Value {
    let result = match name {
        "desk_tree" => {
            let workspace_id = arguments
                .get("workspace_id")
                .and_then(Value::as_str)
                .map(str::to_string);
            let path = arguments
                .get("path")
                .and_then(Value::as_str)
                .map(str::to_string);
            mcp_core::desk_tree(workspace_id, path)
                .and_then(|r| serde_json::to_value(r).map_err(|e| e.to_string()))
        }
        "desk_read" => {
            let path = arguments
                .get("path")
                .and_then(Value::as_str)
                .ok_or_else(|| "desk_read requires 'path'".to_string())
                .map(str::to_string);
            match path {
                Ok(path) => mcp_core::desk_read(path)
                    .and_then(|r| serde_json::to_value(r).map_err(|e| e.to_string())),
                Err(err) => Err(err),
            }
        }
        "desk_search" => {
            let query = arguments
                .get("query")
                .and_then(Value::as_str)
                .ok_or_else(|| "desk_search requires 'query'".to_string())
                .map(str::to_string);
            let path = arguments
                .get("path")
                .and_then(Value::as_str)
                .map(str::to_string);
            match query {
                Ok(query) => mcp_core::desk_search(query, path)
                    .and_then(|r| serde_json::to_value(r).map_err(|e| e.to_string())),
                Err(err) => Err(err),
            }
        }
        "desk_workspace_info" => {
            let workspace_id = arguments
                .get("workspace_id")
                .and_then(Value::as_str)
                .map(str::to_string);
            mcp_core::desk_workspace_info(workspace_id)
                .and_then(|r| serde_json::to_value(r).map_err(|e| e.to_string()))
        }
        "desk_create_task" => {
            let workspace_id = arguments
                .get("workspace_id")
                .and_then(Value::as_str)
                .ok_or_else(|| "desk_create_task requires 'workspace_id'".to_string())
                .map(str::to_string);
            let project_id = arguments
                .get("project_id")
                .and_then(Value::as_str)
                .ok_or_else(|| "desk_create_task requires 'project_id'".to_string())
                .map(str::to_string);
            let title = arguments
                .get("title")
                .and_then(Value::as_str)
                .ok_or_else(|| "desk_create_task requires 'title'".to_string())
                .map(str::to_string);
            let status = arguments.get("status").and_then(Value::as_str).map(str::to_string);
            let priority = arguments.get("priority").and_then(Value::as_str).map(str::to_string);
            let due = arguments.get("due").and_then(Value::as_str).map(str::to_string);
            let content = arguments.get("content").and_then(Value::as_str).map(str::to_string);
            match (workspace_id, project_id, title) {
                (Ok(workspace_id), Ok(project_id), Ok(title)) => mcp_core::desk_create_task(
                    workspace_id, project_id, title, status, priority, due, content
                ).and_then(|r| serde_json::to_value(r).map_err(|e| e.to_string())),
                _ => Err("Invalid input for desk_create_task".to_string()),
            }
        }
        "desk_update_task" => {
            let workspace_id = arguments.get("workspace_id").and_then(Value::as_str).ok_or_else(|| "desk_update_task requires 'workspace_id'".to_string()).map(str::to_string);
            let task_id = arguments.get("task_id").and_then(Value::as_str).ok_or_else(|| "desk_update_task requires 'task_id'".to_string()).map(str::to_string);
            let project_id = arguments.get("project_id").and_then(Value::as_str).map(str::to_string);
            let title = arguments.get("title").and_then(Value::as_str).map(str::to_string);
            let status = arguments.get("status").and_then(Value::as_str).map(str::to_string);
            let priority = arguments.get("priority").and_then(Value::as_str).map(str::to_string);
            let due = arguments.get("due").and_then(Value::as_str).map(str::to_string);
            let content = arguments.get("content").and_then(Value::as_str).map(str::to_string);
            match (workspace_id, task_id) {
                (Ok(workspace_id), Ok(task_id)) => mcp_core::desk_update_task(
                    workspace_id, task_id, project_id, title, status, priority, due, content
                ).and_then(|r| serde_json::to_value(r).map_err(|e| e.to_string())),
                _ => Err("Invalid input for desk_update_task".to_string()),
            }
        }
        "desk_create_meeting" => {
            let workspace_id = arguments.get("workspace_id").and_then(Value::as_str).ok_or_else(|| "desk_create_meeting requires 'workspace_id'".to_string()).map(str::to_string);
            let project_id = arguments.get("project_id").and_then(Value::as_str).ok_or_else(|| "desk_create_meeting requires 'project_id'".to_string()).map(str::to_string);
            let title = arguments.get("title").and_then(Value::as_str).ok_or_else(|| "desk_create_meeting requires 'title'".to_string()).map(str::to_string);
            let date = arguments.get("date").and_then(Value::as_str).map(str::to_string);
            let content = arguments.get("content").and_then(Value::as_str).map(str::to_string);
            match (workspace_id, project_id, title) {
                (Ok(workspace_id), Ok(project_id), Ok(title)) => mcp_core::desk_create_meeting(
                    workspace_id, project_id, title, date, content
                ).and_then(|r| serde_json::to_value(r).map_err(|e| e.to_string())),
                _ => Err("Invalid input for desk_create_meeting".to_string()),
            }
        }
        "desk_update_meeting" => {
            let workspace_id = arguments.get("workspace_id").and_then(Value::as_str).ok_or_else(|| "desk_update_meeting requires 'workspace_id'".to_string()).map(str::to_string);
            let meeting_id = arguments.get("meeting_id").and_then(Value::as_str).ok_or_else(|| "desk_update_meeting requires 'meeting_id'".to_string()).map(str::to_string);
            let project_id = arguments.get("project_id").and_then(Value::as_str).map(str::to_string);
            let title = arguments.get("title").and_then(Value::as_str).map(str::to_string);
            let date = arguments.get("date").and_then(Value::as_str).map(str::to_string);
            let attendees = arguments.get("attendees").and_then(Value::as_array).map(|arr| {
                arr.iter().filter_map(|v| v.as_str().map(str::to_string)).collect::<Vec<_>>()
            });
            let content = arguments.get("content").and_then(Value::as_str).map(str::to_string);
            match (workspace_id, meeting_id) {
                (Ok(workspace_id), Ok(meeting_id)) => mcp_core::desk_update_meeting(
                    workspace_id, meeting_id, project_id, title, date, attendees, content
                ).and_then(|r| serde_json::to_value(r).map_err(|e| e.to_string())),
                _ => Err("Invalid input for desk_update_meeting".to_string()),
            }
        }
        "desk_create_doc" => {
            let workspace_id = arguments.get("workspace_id").and_then(Value::as_str).ok_or_else(|| "desk_create_doc requires 'workspace_id'".to_string()).map(str::to_string);
            let project_id = arguments.get("project_id").and_then(Value::as_str).map(str::to_string);
            let title = arguments.get("title").and_then(Value::as_str).ok_or_else(|| "desk_create_doc requires 'title'".to_string()).map(str::to_string);
            let content = arguments.get("content").and_then(Value::as_str).map(str::to_string);
            match (workspace_id, title) {
                (Ok(workspace_id), Ok(title)) => mcp_core::desk_create_doc(
                    workspace_id, project_id, title, content
                ).and_then(|r| serde_json::to_value(r).map_err(|e| e.to_string())),
                _ => Err("Invalid input for desk_create_doc".to_string()),
            }
        }
        "desk_update_doc" => {
            let workspace_id = arguments.get("workspace_id").and_then(Value::as_str).ok_or_else(|| "desk_update_doc requires 'workspace_id'".to_string()).map(str::to_string);
            let doc_id = arguments.get("doc_id").and_then(Value::as_str).ok_or_else(|| "desk_update_doc requires 'doc_id'".to_string()).map(str::to_string);
            let project_id = arguments.get("project_id").and_then(Value::as_str).map(str::to_string);
            let title = arguments.get("title").and_then(Value::as_str).map(str::to_string);
            let content = arguments.get("content").and_then(Value::as_str).map(str::to_string);
            match (workspace_id, doc_id) {
                (Ok(workspace_id), Ok(doc_id)) => mcp_core::desk_update_doc(
                    workspace_id, doc_id, project_id, title, content
                ).and_then(|r| serde_json::to_value(r).map_err(|e| e.to_string())),
                _ => Err("Invalid input for desk_update_doc".to_string()),
            }
        }
        _ => Err(format!("Unknown tool: {}", name)),
    };

    match result {
        Ok(value) => success_call_result(value),
        Err(err) => error_call_result(&err),
    }
}

#[derive(Debug, Clone, Copy)]
enum StdioMessageMode {
    HeaderFramed,
    JsonLine,
}

fn read_stdin_message<R: BufRead>(reader: &mut R) -> io::Result<Option<(Value, StdioMessageMode)>> {
    let mut content_length: Option<usize> = None;
    let mut saw_header = false;
    loop {
        let mut line = String::new();
        let bytes = reader.read_line(&mut line)?;
        if bytes == 0 {
            return Ok(None);
        }

        let trimmed = line.trim_end_matches(['\r', '\n']);

        if !saw_header && !trimmed.is_empty() && trimmed.starts_with('{') {
            let value: Value = serde_json::from_str(trimmed).map_err(|err| {
                io::Error::new(
                    io::ErrorKind::InvalidData,
                    format!("Invalid JSON line payload in MCP message: {}", err),
                )
            })?;
            return Ok(Some((value, StdioMessageMode::JsonLine)));
        }

        if trimmed.is_empty() {
            break;
        }

        if let Some((name, value)) = trimmed.split_once(':') {
            saw_header = true;
            if name.trim().eq_ignore_ascii_case("content-length") {
                let parsed = value.trim().parse::<usize>().map_err(|err| {
                    io::Error::new(
                        io::ErrorKind::InvalidData,
                        format!("Invalid Content-Length header: {}", err),
                    )
                })?;
                content_length = Some(parsed);
            }
        }
    }

    let len = content_length.ok_or_else(|| {
        io::Error::new(
            io::ErrorKind::InvalidData,
            "Missing Content-Length header in MCP message",
        )
    })?;
    let mut body = vec![0u8; len];
    reader.read_exact(&mut body)?;
    let value: Value = serde_json::from_slice(&body).map_err(|err| {
        io::Error::new(
            io::ErrorKind::InvalidData,
            format!("Invalid JSON payload in MCP message: {}", err),
        )
    })?;
    Ok(Some((value, StdioMessageMode::HeaderFramed)))
}

fn write_stdout_message<W: Write>(
    writer: &mut W,
    value: &Value,
    mode: StdioMessageMode,
) -> io::Result<()> {
    let payload = serde_json::to_vec(value).map_err(|err| {
        io::Error::new(
            io::ErrorKind::InvalidData,
            format!("Failed to serialize MCP response: {}", err),
        )
    })?;

    match mode {
        StdioMessageMode::HeaderFramed => {
            write!(writer, "Content-Length: {}\r\n\r\n", payload.len())?;
            writer.write_all(&payload)?;
        }
        StdioMessageMode::JsonLine => {
            writer.write_all(&payload)?;
            writer.write_all(b"\n")?;
        }
    }
    writer.flush()
}

fn handle_request(request: &Value) -> Option<Value> {
    let id = request.get("id").cloned();
    let method = request
        .get("method")
        .and_then(Value::as_str)
        .unwrap_or_default();
    let params = request.get("params").cloned().unwrap_or_else(|| json!({}));

    let response = match method {
        "initialize" => json!({
          "jsonrpc": "2.0",
          "id": id,
          "result": {
            "protocolVersion": "2024-11-05",
            "serverInfo": {
              "name": "desk-mcp",
              "version": "0.1.0"
            },
            "capabilities": {
              "tools": {}
            }
          }
        }),
        "notifications/initialized" => return None,
        "ping" => json!({
          "jsonrpc": "2.0",
          "id": id,
          "result": {}
        }),
        "tools/list" => json!({
          "jsonrpc": "2.0",
          "id": id,
          "result": {
            "tools": tool_definitions()
          }
        }),
        "tools/call" => {
            let name = params
                .get("name")
                .and_then(Value::as_str)
                .unwrap_or_default();
            let arguments = params
                .get("arguments")
                .cloned()
                .unwrap_or_else(|| json!({}));
            let result = handle_tool_call(name, &arguments);
            json!({
              "jsonrpc": "2.0",
              "id": id,
              "result": result
            })
        }
        _ => json!({
          "jsonrpc": "2.0",
          "id": id,
          "error": {
            "code": -32601,
            "message": format!("Method not found: {}", method)
          }
        }),
    };

    Some(response)
}

fn run_self_test() -> i32 {
    let mut checks = Vec::new();

    checks.push(
        mcp_core::desk_workspace_info(None)
            .map(|_| "workspace_info:ok".to_string())
            .unwrap_or_else(|err| format!("workspace_info:error:{}", err)),
    );
    checks.push(
        mcp_core::desk_tree(None, None)
            .map(|_| "tree:ok".to_string())
            .unwrap_or_else(|err| format!("tree:error:{}", err)),
    );

    let payload = json!({
      "ok": checks.iter().all(|c| !c.contains(":error:")),
      "data_root": mcp_core::get_data_root().to_string_lossy().to_string(),
      "checks": checks,
    });

    let ok = payload.get("ok").and_then(Value::as_bool).unwrap_or(false);
    if let Ok(rendered) = serde_json::to_string_pretty(&payload) {
        println!("{}", rendered);
    } else {
        println!("{}", payload);
    }

    if ok {
        0
    } else {
        1
    }
}

fn run_stdio_server() -> Result<(), String> {
    let stdin = io::stdin();
    let stdout = io::stdout();
    let mut reader = io::BufReader::new(stdin.lock());
    let mut writer = io::BufWriter::new(stdout.lock());

    loop {
        let message = match read_stdin_message(&mut reader) {
            Ok(Some(v)) => v,
            Ok(None) => break,
            Err(err) => {
                eprintln!("MCP stdin read error: {}", err);
                break;
            }
        };
        let (request, mode) = message;

        if let Some(response) = handle_request(&request) {
            write_stdout_message(&mut writer, &response, mode)
                .map_err(|err| format!("Failed to write MCP response: {}", err))?;
        }
    }

    Ok(())
}

fn main() {
    let (cli_data_root, self_test) = match parse_args() {
        Ok(value) => value,
        Err(err) => {
            eprintln!("{}", err);
            std::process::exit(2);
        }
    };

    let resolved_root = mcp_core::resolve_data_root(cli_data_root);
    mcp_core::set_data_root(resolved_root);

    if self_test {
        std::process::exit(run_self_test());
    }

    if let Err(err) = run_stdio_server() {
        eprintln!("{}", err);
        std::process::exit(1);
    }
}
