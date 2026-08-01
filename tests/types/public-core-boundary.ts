// This file is compiled by tsconfig.tooling.json but is not a runtime test.
// Each expected error proves that host-owned persistence cannot leak back into
// the public application API without making type-check fail.

// @ts-expect-error Entity CRUD belongs on getDeskService().
import { createTask } from "@desk/core";
// @ts-expect-error Direct Markdown writes belong on @desk/core/host.
import { writeMarkdownFile } from "@desk/core";
// @ts-expect-error Storage-backed tree reads belong on getDeskService().
import { getContentTree } from "@desk/core";
// @ts-expect-error Maintenance persistence belongs on @desk/core/host.
import { readWorkspaceIndex } from "@desk/core";
// @ts-expect-error Maintenance lifecycle belongs on @desk/core/host.
import { startMaintenanceEngine } from "@desk/core";

void [
  createTask,
  writeMarkdownFile,
  getContentTree,
  readWorkspaceIndex,
  startMaintenanceEngine,
];
