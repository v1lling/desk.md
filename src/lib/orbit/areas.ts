/**
 * Areas library - File system operations for areas
 */
import type { Area } from "@/types";
import { parseMarkdown, serializeMarkdown, todayISO, normalizeDate } from "./parser";
import {
  isTauri,
  getOrbitPath,
  readDir,
  readTextFile,
  writeTextFile,
  mkdir,
  removeDir,
  joinPath,
  exists,
} from "./tauri-fs";
import { mockAreas } from "./mock-data";

interface AreaFrontmatter {
  name: string;
  description?: string;
  color?: string;
  created: string;
}

/**
 * Get all areas
 */
export async function getAreas(): Promise<Area[]> {
  if (!isTauri()) {
    return mockAreas;
  }

  const orbitPath = await getOrbitPath();
  const areasPath = await joinPath(orbitPath, "areas");

  // Check if areas directory exists
  if (!(await exists(areasPath))) {
    return [];
  }

  const entries = await readDir(areasPath);
  const areas: Area[] = [];

  for (const entry of entries) {
    if (entry.isDirectory && !entry.name.startsWith(".")) {
      try {
        const areaPath = await joinPath(areasPath, entry.name, "area.md");
        const content = await readTextFile(areaPath);
        const { data } = parseMarkdown<AreaFrontmatter>(content);

        areas.push({
          id: entry.name,
          name: data.name || entry.name,
          description: data.description,
          color: data.color,
          created: normalizeDate(data.created),
        });
      } catch (e) {
        console.warn(`Failed to read area ${entry.name}:`, e);
      }
    }
  }

  return areas;
}

/**
 * Get a single area by ID
 */
export async function getArea(areaId: string): Promise<Area | null> {
  if (!isTauri()) {
    return mockAreas.find((a) => a.id === areaId) || null;
  }

  const orbitPath = await getOrbitPath();
  const areaPath = await joinPath(orbitPath, "areas", areaId, "area.md");

  try {
    const content = await readTextFile(areaPath);
    const { data } = parseMarkdown<AreaFrontmatter>(content);

    return {
      id: areaId,
      name: data.name || areaId,
      description: data.description,
      color: data.color,
      created: normalizeDate(data.created),
    };
  } catch {
    return null;
  }
}

/**
 * Create a new area
 */
export async function createArea(data: {
  id: string;
  name: string;
  description?: string;
  color?: string;
}): Promise<Area> {
  const area: Area = {
    id: data.id,
    name: data.name,
    description: data.description,
    color: data.color,
    created: todayISO(),
  };

  if (!isTauri()) {
    mockAreas.push(area);
    return area;
  }

  const orbitPath = await getOrbitPath();
  const areaPath = await joinPath(orbitPath, "areas", data.id);

  // Create area directory structure
  await mkdir(areaPath);
  await mkdir(await joinPath(areaPath, "projects"));
  await mkdir(await joinPath(areaPath, "_inbox"));
  await mkdir(await joinPath(areaPath, "_inbox", "tasks"));

  // Create area.md
  const frontmatter: AreaFrontmatter = {
    name: area.name,
    description: area.description,
    color: area.color,
    created: area.created,
  };

  const markdownContent = `# ${area.name}

${area.description || ""}
`;

  const fileContent = serializeMarkdown(frontmatter, markdownContent);
  await writeTextFile(await joinPath(areaPath, "area.md"), fileContent);

  return area;
}

/**
 * Update an existing area
 */
export async function updateArea(
  areaId: string,
  updates: Partial<Pick<Area, "name" | "description" | "color">>
): Promise<Area | null> {
  if (!isTauri()) {
    const index = mockAreas.findIndex((a) => a.id === areaId);
    if (index === -1) return null;
    mockAreas[index] = { ...mockAreas[index], ...updates };
    return mockAreas[index];
  }

  const orbitPath = await getOrbitPath();
  const areaPath = await joinPath(orbitPath, "areas", areaId, "area.md");

  try {
    const content = await readTextFile(areaPath);
    const { data, content: body } = parseMarkdown<AreaFrontmatter>(content);

    const updatedData: AreaFrontmatter = {
      ...data,
      ...(updates.name && { name: updates.name }),
      ...(updates.description !== undefined && { description: updates.description }),
      ...(updates.color !== undefined && { color: updates.color }),
    };

    const fileContent = serializeMarkdown(updatedData, body);
    await writeTextFile(areaPath, fileContent);

    return {
      id: areaId,
      name: updatedData.name,
      description: updatedData.description,
      color: updatedData.color,
      created: updatedData.created,
    };
  } catch {
    return null;
  }
}

/**
 * Delete an area (removes entire directory)
 */
export async function deleteArea(areaId: string): Promise<boolean> {
  if (!isTauri()) {
    const index = mockAreas.findIndex((a) => a.id === areaId);
    if (index === -1) return false;
    mockAreas.splice(index, 1);
    return true;
  }

  const orbitPath = await getOrbitPath();
  const areaPath = await joinPath(orbitPath, "areas", areaId);

  try {
    await removeDir(areaPath);
    return true;
  } catch {
    return false;
  }
}
