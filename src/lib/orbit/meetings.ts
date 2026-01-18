/**
 * Meetings library - File system operations for meeting notes
 */
import type { Meeting } from "@/types";
import { parseMarkdown, serializeMarkdown, generateFilename, filenameToId, todayISO, normalizeDate, generatePreview } from "./parser";
import {
  isTauri,
  getOrbitPath,
  readDir,
  readTextFile,
  writeTextFile,
  mkdir,
  removeFile,
  joinPath,
  exists,
} from "./tauri-fs";
import { mockMeetings } from "./mock-data";
import { SPECIAL_DIRS, PATH_SEGMENTS } from "./constants";
import { findItemInAllAreas } from "./search";

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
  areaId: string,
  projectId: string,
  projectPath: string
): Promise<Meeting[]> {
  const meetingsPath = await joinPath(projectPath, "meetings");

  if (!(await exists(meetingsPath))) {
    return [];
  }

  const entries = await readDir(meetingsPath);
  const meetings: Meeting[] = [];

  for (const entry of entries) {
    if (entry.isFile && entry.name.endsWith(".md")) {
      try {
        const meetingPath = await joinPath(meetingsPath, entry.name);
        const content = await readTextFile(meetingPath);
        const { data, content: body } = parseMarkdown<MeetingFrontmatter>(content);

        meetings.push({
          id: filenameToId(entry.name),
          projectId,
          areaId,
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
 * Get all meetings for an area (across all projects)
 */
export async function getMeetings(areaId: string): Promise<Meeting[]> {
  if (!isTauri()) {
    return mockMeetings.filter((meeting) => meeting.areaId === areaId);
  }

  const orbitPath = await getOrbitPath();
  const projectsPath = await joinPath(orbitPath, "areas", areaId, "projects");

  if (!(await exists(projectsPath))) {
    return [];
  }

  const projectEntries = await readDir(projectsPath);
  const allMeetings: Meeting[] = [];

  for (const entry of projectEntries) {
    if (entry.isDirectory && !entry.name.startsWith(".") && entry.name !== SPECIAL_DIRS.UNASSIGNED) {
      const projectPath = await joinPath(projectsPath, entry.name);
      const projectMeetings = await readProjectMeetings(areaId, entry.name, projectPath);
      allMeetings.push(...projectMeetings);
    }
  }

  // Sort all meetings by date (newest first)
  allMeetings.sort((a, b) => b.date.localeCompare(a.date));

  return allMeetings;
}

/**
 * Get meetings for a specific project
 */
export async function getMeetingsByProject(
  areaId: string,
  projectId: string
): Promise<Meeting[]> {
  if (!isTauri()) {
    return mockMeetings.filter((meeting) => meeting.areaId === areaId && meeting.projectId === projectId);
  }

  const orbitPath = await getOrbitPath();
  const projectPath = await joinPath(orbitPath, "areas", areaId, "projects", projectId);

  return readProjectMeetings(areaId, projectId, projectPath);
}

/**
 * Get a single meeting by ID
 */
export async function getMeeting(
  areaId: string,
  meetingId: string
): Promise<Meeting | null> {
  const meetings = await getMeetings(areaId);
  return meetings.find((meeting) => meeting.id === meetingId) || null;
}

/**
 * Create a new meeting
 */
export async function createMeeting(data: {
  areaId: string;
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
    areaId: data.areaId,
    filePath: "",
    title: data.title,
    date: meetingDate,
    created: todayISO(),
    attendees: data.attendees,
    content,
    preview: generatePreview(content),
  };

  if (!isTauri()) {
    meeting.filePath = `~/Orbit/areas/${data.areaId}/projects/${data.projectId}/meetings/${filename}`;
    mockMeetings.unshift(meeting);
    return meeting;
  }

  const orbitPath = await getOrbitPath();
  const meetingsPath = await joinPath(orbitPath, "areas", data.areaId, "projects", data.projectId, "meetings");

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

  return meeting;
}

/**
 * Update a meeting
 */
export async function updateMeeting(
  meetingId: string,
  updates: Partial<Pick<Meeting, "title" | "date" | "attendees" | "content">>,
  areaId?: string,
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

  // If we have areaId and projectId, we can directly locate the file (fast path)
  if (areaId && projectId) {
    const orbitPath = await getOrbitPath();
    const meetingsPath = await joinPath(orbitPath, PATH_SEGMENTS.AREAS, areaId, PATH_SEGMENTS.PROJECTS, projectId, PATH_SEGMENTS.MEETINGS);

    if (await exists(meetingsPath)) {
      const entries = await readDir(meetingsPath);
      for (const entry of entries) {
        if (entry.isFile && entry.name.endsWith(".md") && filenameToId(entry.name) === meetingId) {
          const filePath = await joinPath(meetingsPath, entry.name);
          const content = await readTextFile(filePath);
          const { data, content: body } = parseMarkdown<MeetingFrontmatter>(content);

          const updatedData: MeetingFrontmatter = {
            ...data,
            ...(updates.title && { title: updates.title }),
            ...(updates.date && { date: updates.date }),
            ...(updates.attendees !== undefined && { attendees: updates.attendees }),
          };

          const updatedContent = updates.content !== undefined ? updates.content : body;
          const fileContent = serializeMarkdown(updatedData, updatedContent);
          await writeTextFile(filePath, fileContent);

          return {
            id: meetingId,
            projectId,
            areaId,
            filePath,
            title: updatedData.title,
            date: updatedData.date,
            created: normalizeDate(data.created),
            attendees: updatedData.attendees,
            content: updatedContent,
            preview: generatePreview(updatedContent),
          };
        }
      }
    }
    return null;
  }

  // Fallback: search all areas (slow path) - uses helper to find item
  const meeting = await findItemInAllAreas(meetingId, getMeetings);
  if (!meeting) return null;

  // Read existing file and update
  const content = await readTextFile(meeting.filePath);
  const { data } = parseMarkdown<MeetingFrontmatter>(content);

  const updatedData: MeetingFrontmatter = {
    ...data,
    ...(updates.title && { title: updates.title }),
    ...(updates.date && { date: updates.date }),
    ...(updates.attendees !== undefined && { attendees: updates.attendees }),
  };

  const updatedContent = updates.content !== undefined ? updates.content : meeting.content;
  const fileContent = serializeMarkdown(updatedData, updatedContent);
  await writeTextFile(meeting.filePath, fileContent);

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
  areaId?: string,
  projectId?: string
): Promise<boolean> {
  if (!isTauri()) {
    const index = mockMeetings.findIndex((m) => m.id === meetingId);
    if (index === -1) return false;
    mockMeetings.splice(index, 1);
    return true;
  }

  // If we have areaId and projectId, we can directly locate the file (fast path)
  if (areaId && projectId) {
    const orbitPath = await getOrbitPath();
    const meetingsPath = await joinPath(orbitPath, PATH_SEGMENTS.AREAS, areaId, PATH_SEGMENTS.PROJECTS, projectId, PATH_SEGMENTS.MEETINGS);

    if (await exists(meetingsPath)) {
      const entries = await readDir(meetingsPath);
      for (const entry of entries) {
        if (entry.isFile && entry.name.endsWith(".md") && filenameToId(entry.name) === meetingId) {
          const filePath = await joinPath(meetingsPath, entry.name);
          await removeFile(filePath);
          return true;
        }
      }
    }
    return false;
  }

  // Fallback: search all areas (slow path) - uses helper to find item
  const meeting = await findItemInAllAreas(meetingId, getMeetings);
  if (!meeting) return false;

  await removeFile(meeting.filePath);
  return true;
}
