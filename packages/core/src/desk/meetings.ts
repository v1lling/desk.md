/**
 * Meetings library - File system operations for meeting notes
 *
 * Uses file-operations.ts for all file I/O (cache invalidation + registry notification handled there).
 * Uses paths.ts for all path construction.
 */
import type { Meeting } from "../types";
import { parseMarkdown, generateFilename, filenameToId, todayISO, normalizeDate, resolveContentDate, generatePreview } from "./parser";
import { isMockMode, joinPath } from "./env";
import { getStorage } from "./storage";
import {
  writeMarkdownFile,
  findAndUpdateFile,
  findAndDeleteFile,
  findFileById,
  readMarkdownFile,
  moveMarkdownFile,
} from "./file-operations";
import { mockMeetings } from "./mock-data";
import { SPECIAL_DIRS, PATH_SEGMENTS, isUnassigned } from "./constants";
import { getProjectPath, getMeetingsPath, getProjectsPath, getUnassignedPath } from "./paths";
import { findItemInAllWorkspaces } from "./search";
import { getFileTreeService } from "./file-cache";

interface MeetingFrontmatter extends Record<string, unknown> {
  title: string;
  date: string;
  created: string;
}

/**
 * Build a Meeting object from frontmatter + metadata
 */
function buildMeeting(
  id: string,
  workspaceId: string,
  projectId: string,
  filePath: string,
  data: MeetingFrontmatter,
  body: string,
  filename?: string
): Meeting {
  return {
    id,
    projectId,
    workspaceId,
    filePath,
    title: data.title || filename || id,
    date: resolveContentDate(data.date || data.created, filename ?? filePath),
    created: resolveContentDate(data.created, filename ?? filePath),
    content: body,
    preview: generatePreview(body),
  };
}

/**
 * Apply meeting updates to existing frontmatter
 */
function applyMeetingUpdates(
  data: MeetingFrontmatter,
  body: string,
  updates: Partial<Pick<Meeting, "title" | "date" | "content">>
): { frontmatter: MeetingFrontmatter; content: string } {
  return {
    frontmatter: {
      ...data,
      // Normalize dates from gray-matter (may be Date objects)
      date: normalizeDate(data.date),
      created: normalizeDate(data.created),
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

        const { data, content: body } = parseMarkdown<MeetingFrontmatter>(content);
        meetings.push(buildMeeting(filenameToId(entry.name), workspaceId, projectId, meetingPath, data, body, entry.name));
      } catch (e) {
        console.warn(`Failed to read meeting ${entry.name}:`, e);
      }
    }
  }

  meetings.sort((a, b) => b.date.localeCompare(a.date));
  return meetings;
}

/**
 * Get all meetings for a workspace (across all projects + unassigned)
 */
export async function getMeetings(workspaceId: string): Promise<Meeting[]> {
  if (isMockMode()) {
    return mockMeetings.filter((meeting) => meeting.workspaceId === workspaceId);
  }

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

  allMeetings.sort((a, b) => b.date.localeCompare(a.date));
  return allMeetings;
}

/**
 * Get meetings for a specific project (or unassigned)
 */
export async function getMeetingsByProject(
  workspaceId: string,
  projectId: string
): Promise<Meeting[]> {
  if (isMockMode()) {
    return mockMeetings.filter((meeting) => meeting.workspaceId === workspaceId && meeting.projectId === projectId);
  }

  const projectPath = await getProjectPath(workspaceId, projectId);
  return readProjectMeetings(workspaceId, projectId, projectPath);
}

/**
 * Get a single meeting by ID
 */
export async function getMeeting(
  workspaceId: string,
  meetingId: string
): Promise<Meeting | null> {
  const meetings = await getMeetings(workspaceId);
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
}): Promise<Meeting> {
  const meetingDate = data.date || todayISO();
  const filename = generateFilename(data.title);
  const id = filenameToId(filename);
  const content = data.content || `# ${data.title}\n\n${data.templateBody || ""}`;

  const meeting: Meeting = {
    id,
    projectId: data.projectId,
    workspaceId: data.workspaceId,
    filePath: "",
    title: data.title,
    date: meetingDate,
    created: todayISO(),
    content,
    preview: generatePreview(content),
  };

  if (isMockMode()) {
    const mockProjectPath = isUnassigned(data.projectId)
      ? `~/Desk/${PATH_SEGMENTS.WORKSPACES}/${data.workspaceId}/${SPECIAL_DIRS.UNASSIGNED}`
      : `~/Desk/${PATH_SEGMENTS.WORKSPACES}/${data.workspaceId}/${PATH_SEGMENTS.PROJECTS}/${data.projectId}`;
    meeting.filePath = `${mockProjectPath}/${PATH_SEGMENTS.MEETINGS}/${filename}`;
    mockMeetings.unshift(meeting);
    return meeting;
  }

  const meetingsPath = await getMeetingsPath(data.workspaceId, data.projectId);
  const filePath = await joinPath(meetingsPath, filename);
  meeting.filePath = filePath;

  const frontmatter: MeetingFrontmatter = {
    title: meeting.title,
    date: meeting.date,
    created: meeting.created,
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
  workspaceId?: string,
  projectId?: string
): Promise<Meeting | null> {
  if (isMockMode()) {
    const index = mockMeetings.findIndex((m) => m.id === meetingId);
    if (index === -1) return null;

    const updatedFields: Partial<Meeting> = { ...updates };
    if (updates.content) {
      updatedFields.preview = generatePreview(updates.content);
    }

    mockMeetings[index] = { ...mockMeetings[index], ...updatedFields };
    return mockMeetings[index];
  }

  // Helper to perform the update at a known meetings directory
  const updateAtPath = async (meetingsPath: string, wsId: string, projId: string): Promise<Meeting | null> => {
    const result = await findAndUpdateFile<MeetingFrontmatter>(
      meetingsPath,
      meetingId,
      (data, body) => applyMeetingUpdates(data, body, updates)
    );
    if (!result) return null;
    return buildMeeting(meetingId, wsId, projId, result.filePath, result.frontmatter, result.content);
  };

  // Fast path: directly locate via workspace + project
  if (workspaceId && projectId) {
    const meetingsPath = await getMeetingsPath(workspaceId, projectId);
    return updateAtPath(meetingsPath, workspaceId, projectId);
  }

  // Slow path: search all workspaces
  const meeting = await findItemInAllWorkspaces(meetingId, getMeetings);
  if (!meeting) return null;

  const meetingsPath = await getMeetingsPath(meeting.workspaceId, meeting.projectId);
  return updateAtPath(meetingsPath, meeting.workspaceId, meeting.projectId);
}

/**
 * Delete a meeting
 */
export async function deleteMeeting(
  meetingId: string,
  workspaceId?: string,
  projectId?: string
): Promise<boolean> {
  if (isMockMode()) {
    const index = mockMeetings.findIndex((m) => m.id === meetingId);
    if (index === -1) return false;
    mockMeetings.splice(index, 1);
    return true;
  }

  // Fast path: directly locate via workspace + project
  if (workspaceId && projectId) {
    const meetingsPath = await getMeetingsPath(workspaceId, projectId);
    const deleted = await findAndDeleteFile(meetingsPath, meetingId);
    return deleted !== null;
  }

  // Slow path: search all workspaces
  const meeting = await findItemInAllWorkspaces(meetingId, getMeetings);
  if (!meeting) return false;

  const meetingsPath = await getMeetingsPath(meeting.workspaceId, meeting.projectId);
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
  if (isMockMode()) {
    const index = mockMeetings.findIndex((m) => m.id === meetingId && m.workspaceId === workspaceId);
    if (index === -1) return null;
    mockMeetings[index] = { ...mockMeetings[index], projectId: toProjectId };
    return mockMeetings[index];
  }

  if (fromProjectId === toProjectId) {
    const meetings = await getMeetings(workspaceId);
    return meetings.find((m) => m.id === meetingId) || null;
  }

  const fromMeetingsPath = await getMeetingsPath(workspaceId, fromProjectId);
  const sourceFilePath = await findFileById(fromMeetingsPath, meetingId);
  if (!sourceFilePath) return null;

  const parsed = await readMarkdownFile<MeetingFrontmatter>(sourceFilePath);
  if (!parsed) return null;

  const toMeetingsPath = await getMeetingsPath(workspaceId, toProjectId);
  const sourceFilename = sourceFilePath.split("/").pop()!;
  const targetFilePath = await joinPath(toMeetingsPath, sourceFilename);

  // moveMarkdownFile handles mkdir, cache invalidation, registry notification
  await moveMarkdownFile(sourceFilePath, targetFilePath);

  return buildMeeting(meetingId, workspaceId, toProjectId, targetFilePath, parsed.frontmatter, parsed.content);
}
