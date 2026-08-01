import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  getDeskService,
  getScopedEntityKey,
  type DeskService,
} from "@desk/core";
import {
  getStorage,
  InMemoryStorageProvider,
  resetDeskRuntime,
  setDataRootResolver,
  setStorage,
} from "@desk/core/host";

describe("dashboard overview", () => {
  let service: DeskService;

  beforeEach(async () => {
    resetDeskRuntime();
    setStorage(new InMemoryStorageProvider());
    setDataRootResolver(async () => "~/DeskMD");
    service = getDeskService();
    await service.createWorkspace({ id: "dashboard", name: "Dashboard", color: "#123456", home: true });
  });

  afterEach(() => resetDeskRuntime());

  it("resolves scoped and legacy highlights without crossing project ownership", async () => {
    const alpha = await service.createProject({ workspaceId: "dashboard", name: "Alpha" });
    const beta = await service.createProject({ workspaceId: "dashboard", name: "Beta" });
    const alphaTask = await service.createTask({
      workspaceId: "dashboard",
      projectId: alpha.id,
      title: "Shared task",
    });
    const betaTask = await service.createTask({
      workspaceId: "dashboard",
      projectId: beta.id,
      title: "Shared task",
    });
    expect(alphaTask.id).toBe(betaTask.id);

    await service.toggleTaskHighlight(
      "dashboard",
      alpha.id,
      getScopedEntityKey(alphaTask),
    );

    let overview = await service.getDashboardOverview({ today: "2099-01-02" });
    expect(overview.focusTasks).toMatchObject([
      {
        id: alphaTask.id,
        workspaceId: "dashboard",
        workspaceName: "Dashboard",
        workspaceColor: "#123456",
        projectId: alpha.id,
        projectName: "Alpha",
      },
    ]);

    // A legacy bare ID in a project scope belongs only to that project.
    await service.toggleTaskHighlight("dashboard", beta.id, betaTask.id);
    overview = await service.getDashboardOverview({ today: "2099-01-02" });
    expect(overview.focusTasks.map((task) => task.projectId).sort()).toEqual([
      alpha.id,
      beta.id,
    ]);
  });

  it("clears a task from workspace and project focus while preserving unrelated highlights", async () => {
    const project = await service.createProject({ workspaceId: "dashboard", name: "Focus" });
    const task = await service.createTask({ workspaceId: "dashboard", projectId: project.id, title: "Remove me" });
    const other = await service.createTask({ workspaceId: "dashboard", projectId: project.id, title: "Keep me" });

    await service.toggleTaskHighlight("dashboard", null, getScopedEntityKey(task));
    await service.toggleTaskHighlight("dashboard", project.id, task.id);
    await service.toggleTaskHighlight("dashboard", null, getScopedEntityKey(other));

    await expect(
      service.clearTaskHighlight("dashboard", project.id, task.id),
    ).resolves.toBe(true);

    const workspaceState = await service.getViewState("dashboard", null);
    const projectState = await service.getViewState("dashboard", project.id);
    expect(workspaceState.highlightedTasks).toEqual([getScopedEntityKey(other)]);
    expect(projectState.highlightedTasks).toEqual([]);
    await expect(
      service.clearTaskHighlight("dashboard", project.id, task.id),
    ).resolves.toBe(false);
  });

  it("returns actionable due tasks and compact recent work with truthful timestamps", async () => {
    const project = await service.createProject({ workspaceId: "dashboard", name: "Delivery" });
    const overdue = await service.createTask({
      workspaceId: "dashboard",
      projectId: project.id,
      title: "Overdue backlog",
      due: "2099-01-01",
    });
    await service.updateTask(overdue.id, { status: "backlog" }, "dashboard", project.id);

    const dueToday = await service.createTask({
      workspaceId: "dashboard",
      projectId: project.id,
      title: "Due today",
      due: "2099-01-02",
      priority: "high",
    });
    await service.createTask({
      workspaceId: "dashboard",
      projectId: project.id,
      title: "Future",
      due: "2099-01-03",
    });
    const done = await service.createTask({
      workspaceId: "dashboard",
      projectId: project.id,
      title: "Already done",
      due: "2099-01-01",
    });
    await service.updateTask(done.id, { status: "done" }, "dashboard", project.id);

    const doc = await service.createDoc({
      workspaceId: "dashboard",
      projectId: project.id,
      title: "Recent document",
    });
    const undatedDoc = await service.createDoc({
      workspaceId: "dashboard",
      projectId: project.id,
      title: "Undated document",
    });
    const undatedPath = undatedDoc.filePath.replace(/[^/]+$/, "undated.md");
    await getStorage().rename(undatedDoc.filePath, undatedPath);
    await getStorage().writeTextFile(
      undatedPath,
      "---\ntitle: Undated document\n---\n\nNo activity stamp\n",
    );
    const pastMeeting = await service.createMeeting({
      workspaceId: "dashboard",
      projectId: project.id,
      title: "Past meeting",
      date: "2099-01-01",
    });
    const futureMeeting = await service.createMeeting({
      workspaceId: "dashboard",
      projectId: project.id,
      title: "Future meeting",
      date: "2099-01-03",
    });

    const overview = await service.getDashboardOverview({
      today: "2099-01-02",
      recentLimit: 20,
    });

    expect(overview.dueTasks.map((task) => task.id)).toEqual([overdue.id, dueToday.id]);
    expect(overview.dueTasks[0]).toMatchObject({ status: "backlog", projectName: "Delivery" });

    const recentIds = new Set(overview.recentWork.map((item) => item.id));
    expect(recentIds).toContain(doc.id);
    expect(recentIds).toContain(pastMeeting.id);
    expect(recentIds).not.toContain("undated");
    expect(recentIds).not.toContain(futureMeeting.id);
    expect(overview.recentWork.every((item) => item.activityAt.length > 0)).toBe(true);

    const capped = await service.getDashboardOverview({ today: "2099-01-02", recentLimit: 2 });
    expect(capped.recentWork).toHaveLength(2);
  });
});
