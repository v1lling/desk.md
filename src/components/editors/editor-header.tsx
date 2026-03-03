
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SaveStatusIndicator, type SaveStatus } from "@/components/ui/save-status";
import { Trash2, Sparkles, Save } from "lucide-react";

interface EditorHeaderProps {
  title: string;
  onTitleChange: (title: string) => void;
  placeholder?: string;
  saveStatus: SaveStatus;
  onSave?: () => void;
  isDirty?: boolean;
  onDelete: () => void;
  /** Whether the document is included in AI indexing */
  aiIncluded?: boolean;
  /** Callback when AI inclusion is toggled */
  onAIInclusionChange?: (included: boolean) => void;
  /** Whether the file is in an excluded folder (toggle disabled) */
  isInExcludedFolder?: boolean;
  /** Path of the excluded folder (for tooltip) */
  excludedFolderPath?: string;
}

export function EditorHeader({
  title,
  onTitleChange,
  placeholder = "Untitled",
  saveStatus,
  onSave,
  isDirty,
  onDelete,
  aiIncluded,
  onAIInclusionChange,
  isInExcludedFolder,
  excludedFolderPath,
}: EditorHeaderProps) {
  // Determine if toggle should be disabled
  const isToggleDisabled = isInExcludedFolder;

  // Build tooltip text
  const getTooltipText = () => {
    if (isInExcludedFolder && excludedFolderPath) {
      return `Excluded by folder: ${excludedFolderPath}`;
    }
    if (aiIncluded) {
      return "Included in AI context (click to exclude)";
    }
    return "Excluded from AI context (click to include)";
  };

  return (
    <div className="flex items-center gap-3 px-6 py-3 border-b border-border/30 bg-background shrink-0">
      <Input
        value={title}
        onChange={(e) => onTitleChange(e.target.value)}
        placeholder={placeholder}
        className="text-lg font-semibold border-none shadow-none px-0 h-auto py-1 focus-visible:ring-0 bg-transparent flex-1"
      />
      <SaveStatusIndicator status={saveStatus} />
      {onSave && (
        <Button
          variant="ghost"
          size="icon"
          onClick={onSave}
          disabled={!isDirty || saveStatus === "saving"}
          title={isDirty ? "Save (⌘S)" : "No changes to save"}
          className={`h-8 w-8 shrink-0 ${
            isDirty
              ? "text-primary hover:text-primary/80"
              : "text-muted-foreground"
          }`}
        >
          <Save className="h-4 w-4" />
        </Button>
      )}
      {onAIInclusionChange && (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => !isToggleDisabled && onAIInclusionChange(!aiIncluded)}
          disabled={isToggleDisabled}
          title={getTooltipText()}
          className={`h-8 w-8 shrink-0 ${
            isToggleDisabled
              ? "text-muted-foreground/50 cursor-not-allowed"
              : aiIncluded
              ? "text-primary hover:text-primary/80"
              : "text-muted-foreground hover:text-muted-foreground/80"
          }`}
        >
          {aiIncluded && !isInExcludedFolder ? (
            <Sparkles className="h-4 w-4" />
          ) : (
            <span className="relative">
              <Sparkles className="h-4 w-4" />
              <span className="absolute inset-0 flex items-center justify-center">
                <span className="w-[18px] h-[2px] bg-current rotate-45 rounded-full" />
              </span>
            </span>
          )}
        </Button>
      )}
      <Button
        variant="ghost"
        size="icon"
        onClick={onDelete}
        className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
