import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import i18next from "eslint-plugin-i18next";

const hostOnlyCoreImports = [
  "getStorage",
  "setStorage",
  "resetStorage",
  "GuardStorageProvider",
  "InMemoryStorageProvider",
  "StorageProvider",
  "DirEntry",
  "FileStat",
  "MemorySeedFile",
  "setDeskService",
  "resetDeskService",
  "setDataRootResolver",
  "resetDataRootResolver",
  "setEditorNotifier",
  "resetEditorNotifier",
  "EditorNotifier",
  "setAgentFileWriter",
  "resetAgentFileWriter",
  "AgentFileWriter",
  "setAIKeyResolver",
  "resetAIKeyResolver",
  "AIKeyRef",
  "AIKeyResolver",
  "resetDeskRuntime",
  "expandFsScope",
  "initDeskDirectory",
  "saveMarkdownBody",
  "writeMarkdownFile",
  "getContentCache",
  "getFileTreeService",
  "startMaintenanceEngine",
  "notifyExternalChanges",
  "readWorkspaceIndex",
  "rebuildWorkspaceIndex",
  "writeRebuiltWorkspaceIndex",
];

const serviceOnlyCoreImports = [
  "getTasks", "getTasksByProject", "getTask", "createTask", "updateTask",
  "deleteTask", "moveTask", "moveTaskToProject",
  "getProjects", "getProject", "createProject", "updateProject", "deleteProject",
  "getWorkspaces", "getWorkspace", "createWorkspace", "updateWorkspace", "deleteWorkspace",
  "getMeetings", "getMeetingsByProject", "getMeeting", "createMeeting",
  "updateMeeting", "deleteMeeting", "moveMeetingToProject",
  "getCaptureTasks", "createCaptureTask", "updateCaptureTask", "deleteCaptureTask",
  "moveCaptureToPersonal", "moveCaptureToWorkspace",
  "getDocs", "getDocsByProject", "getDoc", "createDoc", "updateDoc",
  "deleteDoc", "deleteAsset", "getContentTree", "getAllDocs",
  "getAllDocsForWorkspace", "getWorkspaceDocsShell", "createFolder",
  "renameFolder", "moveFolder", "deleteFolder", "createDocInFolder",
  "importFiles", "moveDoc",
  "getFocusTasks", "getWorkspaceSummaries", "getAllWorkspaceTasksAllStatuses",
  "getViewState", "updateTaskOrder", "removeTaskFromOrder", "setViewMode",
  "setExpandedFolders", "toggleTaskHighlight", "setHiddenStatuses",
  "getSetting", "setSetting", "deskWorkspaceInfo", "deskTree", "deskReadFile",
  "deskFullTextSearch", "buildWorkspaceCatalog", "getIndexCache", "getAIUsage",
  "clearAIUsage", "rebuildSmartIndex", "removeIndexEntry", "clearWorkspaceIndex",
  "getAIMaintenanceInfo", "setAIInclusion", "getAiExclusionState",
  "getFolderAIInclusion", "setFolderAIInclusion",
];

const coreRootBoundary = {
  name: "@desk/core",
  importNames: [...hostOnlyCoreImports, ...serviceOnlyCoreImports],
  message: "Use DeskService for domain I/O and '@desk/core/host' only from approved host adapters.",
};

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: {
      "react-hooks": reactHooks,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/no-explicit-any": "warn",
      "no-restricted-imports": ["error", {
        paths: [coreRootBoundary],
      }],
    },
  },
  // Raw runtime wiring is limited to bootstrap and explicit host adapters.
  // React features and stores must use DeskService or the app-local host-files
  // adapter instead of reaching into StorageProvider directly.
  {
    files: ["packages/app/src/**/*.{ts,tsx}"],
    ignores: [
      "packages/app/src/main.tsx",
      "packages/app/src/lib/host-files.ts",
      "packages/app/src/lib/host-maintenance.ts",
      "packages/app/src/lib/ai/secrets.ts",
    ],
    rules: {
      "no-restricted-imports": ["error", {
        paths: [
          coreRootBoundary,
          {
            name: "@desk/core/host",
            message: "Runtime wiring is restricted to app bootstrap and approved host adapters.",
          },
          {
            name: "@desk/core/host/files",
            message: "Filesystem ownership is restricted to the approved host-file adapter.",
          },
          {
            name: "@desk/core/host/maintenance",
            message: "Maintenance ownership is restricted to the approved maintenance adapter.",
          },
        ],
        patterns: [{
          group: ["@desk/core/src/**", "**/core/src/**"],
          message: "Do not bypass the @desk/core public and host entry points.",
        }],
      }],
    },
  },
  // i18n: forbid hardcoded user-visible strings in app components/pages. New
  // strings must go through t() with a key in src/i18n/en.json. LLM-facing
  // files (see ignores below) keep English in source because models read them.
  {
    files: [
      "packages/app/src/components/**/*.{ts,tsx}",
      "packages/app/src/pages/**/*.{ts,tsx}",
    ],
    plugins: { i18next },
    rules: {
      "i18next/no-literal-string": ["warn", {
        markupOnly: true,
        onlyAttribute: ["title", "placeholder", "alt", "aria-label", "label"],
        ignoreCallee: [
          "t", "i18next.t",
          "console.log", "console.error", "console.warn", "console.info", "console.debug",
          "Error", "TypeError", "RangeError",
          "cn", "clsx", "tw",
          "require", "import",
        ],
        ignoreAttribute: [
          "className", "class", "id", "name", "type", "role", "key",
          "href", "src", "style", "value", "defaultValue",
          "to", "as", "for", "htmlFor", "form",
          "data-*", "aria-hidden", "aria-controls", "aria-describedby", "aria-labelledby",
          "viewBox", "fill", "stroke", "d", "xmlns",
          "rel", "target", "method", "encType", "accept",
          "placeholder",
        ],
        ignoreProperty: [
          "className", "id", "key", "displayName", "name", "type",
          "color", "bg", "icon", "iconName",
          "path", "url", "src", "href",
          "test", "match", "regex",
        ],
      }],
    },
  },
  {
    ignores: [
      "**/dist/**",
      "**/build/**",
      "**/node_modules/**",
      "packages/app/src-tauri/**",
      "scripts/**",
      // LLM-facing strings: prompts, agent files, tool descriptions. These are
      // intentionally English in source because the model reads them.
      "packages/app/src/lib/ai/prompts.ts",
      "packages/app/src/lib/ai/**/prompts.ts",
      "packages/app/src/lib/smart-index/agent-files.ts",
      "packages/app/src/lib/smart-index/artifacts.ts",
    ],
  }
);
