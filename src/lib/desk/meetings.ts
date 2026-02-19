/**
 * Meetings library - File system operations for meeting notes
 */
import type { Meeting } from "@/types";
import { parseMarkdown, serializeMarkdown, generateFilename, filenameToId, todayISO, normalizeDate, generatePreview } from "./parser";
import {
  isTauri,
  readDir,
  readTextFile,
  writeTextFile,
  mkdir,
  removeFile,
  joinPath,
  exists,
} from "./tauri-fs";
import { mockMeetings } from "./mock-data";
import { SPECIAL_DIRS, PATH_SEGMENTS, isUnassigned } from "./constants";
import { getProjectPath, getMeetingsPath, getProjectsPath, getUnassignedPath } from "./paths";
import { findItemInAllWorkspaces } from "./search";
import { getFileTreeService, getContentCache } from "./file-cache";
import { useOpenEditorRegistry } from "@/stores/open-editor-registry";
import { publishDeleted } from "@/stores/editor-event-bus";

interface MeetingFrontmatter {
  title: string;
  date: string;
  created: string;
  attendees?: string[];
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

        // Use cached content from file-tree service
        const content = await fileTreeService.getContentByAbsolutePath<string>(
          meetingPath,
          (raw) => raw
        );

        if (!content) {
          console.warn(`Failed to read meeting ${entry.name}: no content`);
          continue;
        }

        const { data, content: body } = parseMarkdown<MeetingFrontmatter>(content);

        meetings.push({
          id: filenameToId(entry.name),
          projectId,
          workspaceId,
          filePath: meetingPath,
          title: data.title || entry.name,
          date: normalizeDate(data.date || data.created),
          created: normalizeDate(data.created),
          attendees: data.attendees,
          content: body,
          preview: generatePreview(body),
        });
      } catch (e) {
        console.warn(`Failed to read meeting ${entry.name}:`, e);
      }
    }
  }

  // Sort by date (newest first)
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

  // Read meetings from all projects
  for (const entry of projectEntries) {
    if (entry.isDirectory && !entry.name.startsWith(".")) {
      const projectPath = await joinPath(projectsPath, entry.name);
      const projectMeetings = await readProjectMeetings(workspaceId, entry.name, projectPath);
      allMeetings.push(...projectMeetings);
    }
  }

  // Also read unassigned meetings
  const unassignedPath = await getUnassignedPath(workspaceId);
  if (await exists(unassignedPath)) {
    const unassignedMeetings = await readProjectMeetings(workspaceId, SPECIAL_DIRS.UNASSIGNED, unassignedPath);
    allMeetings.push(...unassignedMeetings);
  }

  // Sort all meetings by date (newest first)
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

  // Ensure meetings directory exists
  await mkdir(meetingsPath);

  const filePath = await joinPath(meetingsPath, filename);
  meeting.filePath = filePath;

  // Create meeting file
  const frontmatter: MeetingFrontmatter = {
    title: meeting.title,
    date: meeting.date,
    created: meeting.created,
    ...(meeting.attendees && { attendees: meeting.attendees }),
  };

  const fileContent = serializeMarkdown(frontmatter, meeting.content);
  await writeTextFile(filePath, fileContent);

  // Invalidate file-tree cache so list views see the new file immediately
  getContentCache().invalidate(filePath);

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

  // If we have workspaceId and projectId, we can directly locate the file (fast path)
  if (workspaceId && projectId) {
    const meetingsPath = await getMeetingsPath(workspaceId, projectId);

    if (await exists(meetingsPath)) {
      const entries = await readDir(meetingsPath);
      for (const entry of entries) {
        if (entry.isFile && entry.name.endsWith(".md") && filenameToId(entry.name) === meetingId) {
          const filePath = await joinPath(meetingsPath, entry.name);
          const content = await readTextFile(filePath);
          const { data, content: body } = parseMarkdown<MeetingFrontmatter>(content);

          // Normalize dates from gray-matter (may be Date objects) to YYYY-MM-DD strings
          const updatedData: MeetingFrontmatter = {
            ...data,
            date: normalizeDate(data.date),
            created: normalizeDate(data.created),
            ...(updates.title && { title: updates.title }),
            ...(updates.date && { date: updates.date }),
            ...(updates.attendees !== undefined && { attendees: updates.attendees }),
          };

          const updatedContent = updates.content !== undefined ? updates.content : body;
          const fileContent = serializeMarkdown(updatedData, updatedContent);
          await writeTextFile(filePath, fileContent);

          // Invalidate file-tree cache so list views see updated data immediately
          getContentCache().invalidate(filePath);

          // Notify registry if file is open (prevents false "external change" detection)
          const registry = useOpenEditorRegistry.getState();
          if (registry.isOpen(filePath)) {
            registry.updateLastSaved(filePath, updatedContent);
          }

          return {
            id: meetingId,
            projectId,
            workspaceId,
            filePath,
            title: updatedData.title,
            date: updatedData.date,
            created: updatedData.created,
            attendees: updatedData.attendees,
            content: updatedContent,
            preview: generatePreview(updatedContent),
          };
        }
      }
    }
    return null;
  }

  // Fallback: search all workspaces (slow path) - uses helper to find item
  const meeting = await findItemInAllWorkspaces(meetingId, getMeetings);
  if (!meeting) return null;

  // Read existing file and update
  const content = await readTextFile(meeting.filePath);
  const { data, content: body } = parseMarkdown<MeetingFrontmatter>(content);

  // Normalize dates from gray-matter (may be Date objects) to YYYY-MM-DD strings
  const updatedData: MeetingFrontmatter = {
    ...data,
    date: normalizeDate(data.date),
    created: normalizeDate(data.created),
    ...(updates.title && { title: updates.title }),
    ...(updates.date && { date: updates.date }),
    ...(updates.attendees !== undefined && { attendees: updates.attendees }),
  };

  // Use body from disk (not meeting.content from TanStack Query which may be stale)
  const updatedContent = updates.content !== undefined ? updates.content : body;
  const fileContent = serializeMarkdown(updatedData, updatedContent);
  await writeTextFile(meeting.filePath, fileContent);

  // Invalidate file-tree cache so list views see updated data immediately
  getContentCache().invalidate(meeting.filePath);

  // Notify registry if file is open (prevents false "external change" detection)
  const registry = useOpenEditorRegistry.getState();
  if (registry.isOpen(meeting.filePath)) {
    registry.updateLastSaved(meeting.filePath, updatedContent);
  }

  return {
    ...meeting,
    title: updatedData.title,
    date: updatedData.date,
    attendees: updatedData.attendees,
    content: updatedContent,
    preview: generatePreview(updatedContent),
  };
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

  // If we have workspaceId and projectId, we can directly locate the file (fast path)
  if (workspaceId && projectId) {
    const meetingsPath = await getMeetingsPath(workspaceId, projectId);

    if (await exists(meetingsPath)) {
      const entries = await readDir(meetingsPath);
      for (const entry of entries) {
        if (entry.isFile && entry.name.endsWith(".md") && filenameToId(entry.name) === meetingId) {
          const filePath = await joinPath(meetingsPath, entry.name);

          // Notify editor if file was open
          const registry = useOpenEditorRegistry.getState();
          if (registry.isOpen(filePath)) {
            registry.handlePathDeleted(filePath);
            publishDeleted(filePath);
          }

          await removeFile(filePath);
          return true;
        }
      }
    }
    return false;
  }

  // Fallback: search all workspaces (slow path) - uses helper to find item
  const meeting = await findItemInAllWorkspaces(meetingId, getMeetings);
  if (!meeting) return false;

  // Notify editor if file was open
  const registry = useOpenEditorRegistry.getState();
  if (registry.isOpen(meeting.filePath)) {
    registry.handlePathDeleted(meeting.filePath);
    publishDeleted(meeting.filePath);
  }

  await removeFile(meeting.filePath);
  return true;
}
