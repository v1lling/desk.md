/**
 * Meetings library - File system operations for meeting notes
 *
 * Uses file-operations.ts for all file I/O (cache invalidation + registry notification handled there).
 * Uses paths.ts for all path construction.
 */
import type { Meeting } from "@/types";
import { parseMarkdown, generateFilename, filenameToId, todayISO, normalizeDate, generatePreview } from "./parser";
import { isTauri, readDir, joinPath, exists } from "./tauri-fs";
import {
  writeMarkdownFile,
  findAndUpdateFile,
  findAndDeleteFile,
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
  attendees?: string[];
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
    date: normalizeDate(data.date || data.created),
    created: normalizeDate(data.created),
    attendees: data.attendees,
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
  updates: Partial<Pick<Meeting, "title" | "date" | "attendees" | "content">>
): { frontmatter: MeetingFrontmatter; content: string } {
  return {
    frontmatter: {
      ...data,
      // Normalize dates from gray-matter (may be Date objects)
      date: normalizeDate(data.date),
      created: normalizeDate(data.created),
      ...(updates.title && { title: updates.title }),
      ...(updates.date && { date: updates.date }),
      ...(updates.attendees !== undefined && { attendees: updates.attendees }),
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

  if (!(await exists(meetingsPath))) {
    return [];
  }

  const entries = await readDir(meetingsPath);
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
  if (!isTauri()) {
    return mockMeetings.filter((meeting) => meeting.workspaceId === workspaceId);
  }

  const projectsPath = await getProjectsPath(workspaceId);

  if (!(await exists(projectsPath))) {
    return [];
  }

  const projectEntries = await readDir(projectsPath);
  const allMeetings: Meeting[] = [];

  for (const entry of projectEntries) {
    if (entry.isDirectory && !entry.name.startsWith(".")) {
      const projectPath = await joinPath(projectsPath, entry.name);
      const projectMeetings = await readProjectMeetings(workspaceId, entry.name, projectPath);
      allMeetings.push(...projectMeetings);
    }
  }

  const unassignedPath = await getUnassignedPath(workspaceId);
  if (await exists(unassignedPath)) {
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
  if (!isTauri()) {
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
  attendees?: string[];
  content?: string;
}): Promise<Meeting> {
  const meetingDate = data.date || todayISO();
  const filename = generateFilename(data.title);
  const id = filenameToId(filename);
  const content = data.content || `# ${data.title}\n\n## Attendees\n${data.attendees?.map(a => `- ${a}`).join('\n') || '- '}\n\n## Agenda\n- \n\n## Notes\n\n\n## Action Items\n- [ ] `;

  const meeting: Meeting = {
    id,
    projectId: data.projectId,
    workspaceId: data.workspaceId,
    filePath: "",
    title: data.title,
    date: meetingDate,
    created: todayISO(),
    attendees: data.attendees,
    content,
    preview: generatePreview(content),
  };

  if (!isTauri()) {
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
    ...(meeting.attendees && { attendees: meeting.attendees }),
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
  updates: Partial<Pick<Meeting, "title" | "date" | "attendees" | "content">>,
  workspaceId?: string,
  projectId?: string
): Promise<Meeting | null> {
  if (!isTauri()) {
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
  if (!isTauri()) {
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
