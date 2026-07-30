import { SPECIAL_DIRS } from "./constants";
import {
  browserDocs,
  browserMeetings,
  browserProjects,
  browserTasks,
  browserViewState,
  browserWorkspaces,
} from "./browser-fixtures";
import { serializeMarkdown } from "./parser";
import type { MemorySeedFile } from "./storage/memory-provider";

const DATA_ROOT = "~/DeskMD";

function date(value?: string): Date | undefined {
  return value ? new Date(value) : undefined;
}

/**
 * Convert the human-readable browser fixtures into the canonical Markdown
 * layout. Fixtures are immutable inputs; all browser CRUD mutates these files.
 */
export function createBrowserSeedFiles(): MemorySeedFile[] {
  const files: MemorySeedFile[] = [];

  for (const workspace of browserWorkspaces) {
    files.push({
      path: `${DATA_ROOT}/workspaces/${workspace.id}/workspace.md`,
      content: serializeMarkdown(
        {
          name: workspace.name,
          description: workspace.description,
          color: workspace.color,
          created: workspace.created,
          ...(workspace.isHome && { home: true }),
        },
        workspace.overview ?? "",
      ),
      createdAt: date(workspace.created),
    });
  }

  for (const project of browserProjects) {
    files.push({
      path: `${DATA_ROOT}/workspaces/${project.workspaceId}/projects/${project.id}/project.md`,
      content: serializeMarkdown(
        {
          name: project.name,
          status: project.status,
          description: project.description,
          created: project.created,
        },
        project.overview ?? "",
      ),
      createdAt: date(project.created),
    });
  }

  for (const task of browserTasks) {
    const updated = task.updated ?? (task.created ? `${task.created}T09:00:00.000Z` : undefined);
    files.push({
      path: task.filePath,
      content: serializeMarkdown(
        {
          title: task.title,
          status: task.status,
          priority: task.priority,
          due: task.due,
          created: task.created,
          updated,
          author: task.author,
        },
        task.content,
      ),
      createdAt: date(task.created),
      modifiedAt: date(updated),
    });
  }

  for (const doc of browserDocs) {
    const updated = doc.updated ?? (doc.created ? `${doc.created}T10:00:00.000Z` : undefined);
    files.push({
      path: doc.filePath,
      content: serializeMarkdown(
        {
          title: doc.title,
          created: doc.created,
          updated,
          author: doc.author,
        },
        doc.content,
      ),
      createdAt: date(doc.created),
      modifiedAt: date(updated),
    });
  }

  for (const meeting of browserMeetings) {
    const updated = meeting.updated ?? (meeting.created ? `${meeting.created}T11:00:00.000Z` : undefined);
    files.push({
      path: meeting.filePath,
      content: serializeMarkdown(
        {
          title: meeting.title,
          date: meeting.date,
          created: meeting.created,
          updated,
          author: meeting.author,
        },
        meeting.content,
      ),
      createdAt: date(meeting.created),
      modifiedAt: date(updated),
    });
  }

  for (const [key, state] of Object.entries(browserViewState)) {
    const [workspaceId, projectId] = key.split("/");
    const path = projectId
      ? `${DATA_ROOT}/workspaces/${workspaceId}/projects/${projectId}/.view.json`
      : `${DATA_ROOT}/workspaces/${workspaceId}/.view.json`;
    files.push({ path, content: JSON.stringify(state, null, 2) });
  }

  files.push({
    path: `${DATA_ROOT}/workspaces/personal/${SPECIAL_DIRS.CAPTURE}/tasks/book-dentist.md`,
    content: serializeMarkdown(
      {
        title: "Book dentist appointment",
        status: "todo",
        priority: "low",
        created: "2024-01-16",
        updated: "2024-01-16T09:00:00.000Z",
      },
      "Remember to book the 6-month checkup",
    ),
    createdAt: new Date("2024-01-16"),
    modifiedAt: new Date("2024-01-16T09:00:00.000Z"),
  });

  return files;
}
