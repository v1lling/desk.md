export interface DeskRpcValidationIssue {
  path: string;
  message: string;
}

type ScalarKind = "string" | "boolean";

interface FieldRule {
  kind: ScalarKind;
  required?: boolean;
  nullable?: boolean;
  values?: readonly string[];
}

interface ObjectRule {
  argument: number;
  fields: Record<string, FieldRule>;
}

const TASK_STATUSES = ["backlog", "todo", "doing", "waiting", "done"] as const;
const TASK_PRIORITIES = ["low", "medium", "high"] as const;
const PROJECT_STATUSES = ["active", "paused", "completed", "archived"] as const;

const STRING_REQUIRED: FieldRule = { kind: "string", required: true };
const STRING_OPTIONAL: FieldRule = { kind: "string" };
const STRING_NULLABLE: FieldRule = { kind: "string", nullable: true };

const OBJECT_RULES: Record<string, ObjectRule> = {
  createWorkspace: {
    argument: 0,
    fields: {
      id: STRING_REQUIRED,
      name: STRING_REQUIRED,
      description: STRING_OPTIONAL,
      overview: STRING_OPTIONAL,
      color: STRING_OPTIONAL,
      home: { kind: "boolean" },
    },
  },
  updateWorkspace: {
    argument: 1,
    fields: {
      name: STRING_OPTIONAL,
      description: STRING_NULLABLE,
      overview: STRING_NULLABLE,
      color: STRING_NULLABLE,
    },
  },
  createProject: {
    argument: 0,
    fields: {
      workspaceId: STRING_REQUIRED,
      name: STRING_REQUIRED,
      description: STRING_OPTIONAL,
      status: { kind: "string", values: PROJECT_STATUSES },
    },
  },
  updateProject: {
    argument: 1,
    fields: {
      name: STRING_OPTIONAL,
      description: STRING_NULLABLE,
      overview: STRING_NULLABLE,
      status: { kind: "string", values: PROJECT_STATUSES },
    },
  },
  createTask: {
    argument: 0,
    fields: {
      workspaceId: STRING_REQUIRED,
      projectId: STRING_REQUIRED,
      title: STRING_REQUIRED,
      priority: { kind: "string", values: TASK_PRIORITIES },
      due: STRING_OPTIONAL,
      content: STRING_OPTIONAL,
      templateBody: STRING_OPTIONAL,
      author: { kind: "string", values: ["ai"] },
    },
  },
  updateTask: {
    argument: 1,
    fields: {
      title: STRING_OPTIONAL,
      status: { kind: "string", values: TASK_STATUSES },
      content: STRING_OPTIONAL,
      projectId: STRING_OPTIONAL,
      priority: { kind: "string", nullable: true, values: TASK_PRIORITIES },
      due: STRING_NULLABLE,
    },
  },
  createMeeting: {
    argument: 0,
    fields: {
      workspaceId: STRING_REQUIRED,
      projectId: STRING_REQUIRED,
      title: STRING_REQUIRED,
      date: STRING_OPTIONAL,
      content: STRING_OPTIONAL,
      templateBody: STRING_OPTIONAL,
      author: { kind: "string", values: ["ai"] },
    },
  },
  updateMeeting: {
    argument: 1,
    fields: {
      title: STRING_OPTIONAL,
      date: STRING_OPTIONAL,
      content: STRING_OPTIONAL,
    },
  },
  createCaptureTask: {
    argument: 0,
    fields: {
      title: STRING_REQUIRED,
      priority: { kind: "string", values: TASK_PRIORITIES },
      due: STRING_OPTIONAL,
      content: STRING_OPTIONAL,
    },
  },
  updateCaptureTask: {
    argument: 1,
    fields: {
      title: STRING_OPTIONAL,
      status: { kind: "string", values: TASK_STATUSES },
      content: STRING_OPTIONAL,
      priority: { kind: "string", nullable: true, values: TASK_PRIORITIES },
      due: STRING_NULLABLE,
    },
  },
  createDoc: {
    argument: 0,
    fields: {
      workspaceId: STRING_REQUIRED,
      projectId: STRING_REQUIRED,
      title: STRING_REQUIRED,
      content: STRING_OPTIONAL,
      templateBody: STRING_OPTIONAL,
      author: { kind: "string", values: ["ai"] },
    },
  },
  createDocInFolder: {
    argument: 0,
    fields: {
      scope: { kind: "string", required: true, values: ["personal", "workspace", "project"] },
      title: STRING_REQUIRED,
      content: STRING_OPTIONAL,
      templateBody: STRING_OPTIONAL,
      folderPath: STRING_OPTIONAL,
      workspaceId: STRING_OPTIONAL,
      projectId: STRING_OPTIONAL,
      filename: STRING_OPTIONAL,
      author: { kind: "string", values: ["ai"] },
      updatedStamp: STRING_OPTIONAL,
    },
  },
  updateDoc: {
    argument: 1,
    fields: {
      title: STRING_OPTIONAL,
      content: STRING_OPTIONAL,
    },
  },
};

/**
 * Validate the entity mutation values that cross the untyped HTTP boundary.
 * Unknown object fields remain allowed for forward compatibility.
 */
export function validateDeskRpcEntityMutation(
  operation: string,
  args: unknown[],
): DeskRpcValidationIssue | null {
  if (operation === "moveTask") {
    return validateEnumArgument(args[1], "args[1]", TASK_STATUSES);
  }

  const rule = OBJECT_RULES[operation];
  if (!rule) return null;

  const value = args[rule.argument];
  const path = `args[${rule.argument}]`;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { path, message: "expected an object" };
  }

  const record = value as Record<string, unknown>;
  for (const [field, fieldRule] of Object.entries(rule.fields)) {
    const fieldValue = record[field];
    const fieldPath = `${path}.${field}`;
    if (fieldValue === undefined) {
      if (fieldRule.required) return { path: fieldPath, message: "field is required" };
      continue;
    }
    if (fieldValue === null && fieldRule.nullable) continue;
    if (typeof fieldValue !== fieldRule.kind) {
      return { path: fieldPath, message: `expected ${fieldRule.kind}` };
    }
    if (
      fieldRule.values &&
      !fieldRule.values.includes(fieldValue as string)
    ) {
      return {
        path: fieldPath,
        message: `expected one of ${fieldRule.values.join(", ")}`,
      };
    }
  }

  return null;
}

function validateEnumArgument(
  value: unknown,
  path: string,
  allowed: readonly string[],
): DeskRpcValidationIssue | null {
  if (typeof value !== "string" || !allowed.includes(value)) {
    return { path, message: `expected one of ${allowed.join(", ")}` };
  }
  return null;
}
