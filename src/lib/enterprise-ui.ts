export type Density = "compact" | "regular" | "relaxed";

export const densityClasses: Record<Density, {
  header: string;
  section: string;
  content: string;
  card: string;
  row: string;
}> = {
  compact: {
    header: "h-12",
    section: "min-h-10",
    content: "p-3",
    card: "rounded-lg p-3",
    row: "h-8 px-2.5",
  },
  regular: {
    header: "h-14",
    section: "min-h-11",
    content: "p-4",
    card: "rounded-xl p-4",
    row: "h-9 px-3",
  },
  relaxed: {
    header: "h-14",
    section: "min-h-11",
    content: "p-5",
    card: "rounded-xl p-5",
    row: "h-10 px-3.5",
  },
};

export const appSurfaceClasses = {
  pageRoot: "flex flex-col h-full overflow-hidden bg-background",
  pageBody: "flex-1 min-h-0",
  card: "border border-border/80 bg-card text-card-foreground shadow-sm",
  denseCard: "border border-border/80 bg-card text-card-foreground",
  mutedSurface: "bg-muted/35",
  // Section surface tokens — list-first layout
  sectionGroup: "",
  sectionGroupInset: "bg-muted/20 rounded-lg",
  sectionDivider: "h-px bg-border/60",
  sectionLabel: "text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60",
} as const;

export const workspaceUiDefaults = {
  color: "#64748b",
} as const;

export type TemplateVariant = "workspace" | "project" | "settings";
