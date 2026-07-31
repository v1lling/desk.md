/**
 * Meetings library - File system operations for meeting notes
 *
 * Uses file-operations.ts for all file I/O (cache invalidation + registry notification handled there).
 * Uses paths.ts for all path construction.
 */
import type { Meeting } from "../types";
import { parseMarkdown, generateFilename, filenameToId, todayISO, nowISO, normalizeOptionalDate, compareDatesDesc, generatePreview } from "./parser";
import {
  decodeMeetingFrontmatter,
  reportFrontmatterDiagnostics,
} from "./frontmatter";
import { joinPath } from "./env";
import { getStorage } from "./storage";
import {
  writeMarkdownFile,
  findAndUpdateFile,
  findAndDeleteFile,
  findFileById,
  readMarkdownFile,
  moveMarkdownFile,
  allocateUniqueFilePath,
} from "./file-operations";
import { SPECIAL_DIRS, PATH_SEGMENTS } from "./constants";
import { getProjectPath, getMeetingsPath, getProjectsPath, getUnassignedPath } from "./paths";
import { getFileTreeService } from "./file-cache";

interface MeetingFrontmatter extends Record<string, unknown> {
  title: string;
  date?: string;
  created?: string;
  updated?: string;
  author?: string;
}

/**
 * Build a Meeting object from frontmatter + metadata
 */
function buildMeeting(
  id: string,
  workspaceId: string,
  projectId: string,
  filePath: string,
  data: Record<string, unknown>,
  body: string,
  filename?: string
): Meeting {
  const decoded = decodeMeetingFrontmatter(
    data,
    filename || id,
    filename ?? filePath,
  );
  reportFrontmatterDiagnostics("meeting", filePath, decoded.diagnostics);
  const metadata = decoded.value;
  return {
    id,
    projectId,
    workspaceId,
    filePath,
    title: metadata.title,
    date: metadata.date,
    created: metadata.created,
    updated: metadata.updated,
    author: metadata.author,
    content: body,
    preview: generatePreview(body),
  };
}

/**
 * Apply meeting updates to existing frontmatter
 */
function applyMeetingUpdates(
  data: Record<string, unknown>,
  body: string,
  updates: Partial<Pick<Meeting, "title" | "date" | "content">>
): { frontmatter: Record<string, unknown>; content: string } {
  return {
    frontmatter: {
      ...data,
      // Normalize dates from gray-matter (may be Date objects). Absence is preserved —
      // a file without date/created must not get a fabricated date stamped in on save.
      date: normalizeOptionalDate(data.date),
      created: normalizeOptionalDate(data.created),
      ...(updates.title && { title: updates.title }),
      ...(updates.date && { date: updates.date }),
    },
    content: updates.content !== undefined ? updates.content : body,
  };
}

/**
 * Read all meetings from a project's meetings directory
 */
async function readProjectMeetings(
  workspaceId: string,
  projectId: string,
  projectPath: string
): Promise<Meeting[]> {
  const meetingsPath = await joinPath(projectPath, PATH_SEGMENTS.MEETINGS);

  if (!(await getStorage().exists(meetingsPath))) {
    return [];
  }

  const entries = await getStorage().readDir(meetingsPath);
  const meetings: Meeting[] = [];
  const fileTreeService = getFileTreeService();

  for (const entry of entries) {
    if (entry.isFile && entry.name.endsWith(".md")) {
      try {
        const meetingPath = await joinPath(meetingsPath, entry.name);

        const content = await fileTreeService.getContentByAbsolutePath<string>(
          meetingPath,
          (raw) => raw
        );

        if (!content) {
          console.warn(`Failed to read meeting ${entry.name}: no content`);
          continue;
        }

        const { data, content: body } = parseMarkdown<Record<string, unknown>>(content);
        meetings.push(buildMeeting(filenameToId(entry.name), workspaceId, projectId, meetingPath, data, body, entry.name));
      } catch (e) {
        console.warn(`Failed to read meeting ${entry.name}:`, e);
      }
    }
  }

  meetings.sort((a, b) => compareDatesDesc(a.date, b.date));
  return meetings;
}

/**
 * Get all meetings for a workspace (across all projects + unassigned)
 */
export async function getMeetings(workspaceId: string): Promise<Meeting[]> {
  const projectsPath = await getProjectsPath(workspaceId);

  if (!(await getStorage().exists(projectsPath))) {
    return [];
  }

  const projectEntries = await getStorage().readDir(projectsPath);
  const allMeetings: Meeting[] = [];

  for (const entry of projectEntries) {
    if (entry.isDirectory && !entry.name.startsWith(".")) {
      const projectPath = await joinPath(projectsPath, entry.name);
      const projectMeetings = await readProjectMeetings(workspaceId, entry.name, projectPath);
      allMeetings.push(...projectMeetings);
    }
  }

  const unassignedPath = await getUnassignedPath(workspaceId);
  if (await getStorage().exists(unassignedPath)) {
    const unassignedMeetings = await readProjectMeetings(workspaceId, SPECIAL_DIRS.UNASSIGNED, unassignedPath);
    allMeetings.push(...unassignedMeetings);
  }

  allMeetings.sort((a, b) => compareDatesDesc(a.date, b.date));
  return allMeetings;
}

/**
 * Get meetings for a specific project (or unassigned)
 */
export async function getMeetingsByProject(
  workspaceId: string,
  projectId: string
): Promise<Meeting[]> {
  const projectPath = await getProjectPath(workspaceId, projectId);
  return readProjectMeetings(workspaceId, projectId, projectPath);
}

/**
 * Get a single meeting by ID
 */
export async function getMeeting(
  workspaceId: string,
  projectId: string,
  meetingId: string,
): Promise<Meeting | null> {
  const meetings = await getMeetingsByProject(workspaceId, projectId);
  return meetings.find((meeting) => meeting.id === meetingId) || null;
}

/**
 * Create a new meeting
 */
export async function createMeeting(data: {
  workspaceId: string;
  projectId: string;
  title: string;
  date?: string;
  content?: string;
  templateBody?: string;
  author?: "ai";
}): Promise<Meeting> {
  const meetingDate = data.date || todayISO();
  const preferredFilename = generateFilename(data.title);
  const meetingsPath = await getMeetingsPath(data.workspaceId, data.projectId);
  const { filename, filePath } = await allocateUniqueFilePath(meetingsPath, preferredFilename);

  const id = filenameToId(filename);
  const content = data.content || `# ${data.title}\n\n${data.templateBody || ""}`;

  const meeting: Meeting = {
    id,
    projectId: data.projectId,
    workspaceId: data.workspaceId,
    filePath,
    title: data.title,
    date: meetingDate,
    created: todayISO(),
    updated: nowISO(),
    author: data.author,
    content,
    preview: generatePreview(content),
  };

  const frontmatter: MeetingFrontmatter = {
    title: meeting.title,
    date: meeting.date,
    created: meeting.created,
    ...(meeting.author ? { author: meeting.author } : {}),
  };

  // writeMarkdownFile handles mkdir + cache invalidation
  await writeMarkdownFile(filePath, frontmatter, meeting.content);

  return meeting;
}

/**
 * Update a meeting
 */
export async function updateMeeting(
  meetingId: string,
  updates: Partial<Pick<Meeting, "title" | "date" | "content">>,
  workspaceId: string,
  projectId: string
): Promise<Meeting | null> {
  const meetingsPath = await getMeetingsPath(workspaceId, projectId);
  const result = await findAndUpdateFile<Record<string, unknown>>(
    meetingsPath,
    meetingId,
    (data, body) => applyMeetingUpdates(data, body, updates)
  );
  if (!result) return null;
  return buildMeeting(meetingId, workspaceId, projectId, result.filePath, result.frontmatter, result.content);
}

/**
 * Delete a meeting
 */
export async function deleteMeeting(
  meetingId: string,
  workspaceId: string,
  projectId: string
): Promise<boolean> {
  const meetingsPath = await getMeetingsPath(workspaceId, projectId);
  const deleted = await findAndDeleteFile(meetingsPath, meetingId);
  return deleted !== null;
}

/**
 * Move meeting to a different project (physically moves the file)
 */
export async function moveMeetingToProject(
  meetingId: string,
  workspaceId: string,
  fromProjectId: string,
  toProjectId: string
): Promise<Meeting | null> {
  if (fromProjectId === toProjectId) {
    const meetings = await getMeetingsByProject(workspaceId, fromProjectId);
    return meetings.find((m) => m.id === meetingId) || null;
  }

  const fromMeetingsPath = await getMeetingsPath(workspaceId, fromProjectId);
  const sourceFilePath = await findFileById(fromMeetingsPath, meetingId);
  if (!sourceFilePath) return null;

  const parsed = await readMarkdownFile<Record<string, unknown>>(sourceFilePath);
  if (!parsed) return null;

  const toMeetingsPath = await getMeetingsPath(workspaceId, toProjectId);
  const sourceFilename = sourceFilePath.split("/").pop()!;
  const targetFilePath = await joinPath(toMeetingsPath, sourceFilename);

  // moveMarkdownFile handles mkdir, cache invalidation, registry notification
  await moveMarkdownFile(sourceFilePath, targetFilePath);

  return buildMeeting(meetingId, workspaceId, toProjectId, targetFilePath, parsed.frontmatter, parsed.content);
}
