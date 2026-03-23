import { useRef } from "react";
import { workspaceColorOptions } from "@/lib/design-tokens";

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
}

export function ColorPicker({ value, onChange }: ColorPickerProps) {
  const nativeInputRef = useRef<HTMLInputElement>(null);

  const isPreset = workspaceColorOptions.some((opt) => opt.value === value);

  return (
    <div className="flex gap-2 flex-wrap items-center">
      {workspaceColorOptions.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`w-8 h-8 rounded-full border-2 transition-all ${
            value === opt.value
              ? "border-foreground scale-110"
              : "border-transparent hover:scale-105"
          }`}
          style={{ backgroundColor: opt.value }}
          title={opt.label}
        />
      ))}

      {/* Custom color button — opens native picker */}
      <button
        type="button"
        onClick={() => nativeInputRef.current?.click()}
        className={`w-8 h-8 rounded-full border-2 transition-all flex items-center justify-center ${
          !isPreset
            ? "border-foreground scale-110"
            : "border-muted-foreground/30 hover:scale-105"
        }`}
        style={!isPreset ? { backgroundColor: value } : undefined}
        title="Custom color"
      >
        {isPreset && (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-muted-foreground">
            <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" />
            <path d="M8 2a6 6 0 0 1 0 12" fill="currentColor" opacity="0.3" />
            <circle cx="8" cy="8" r="2" fill="currentColor" />
          </svg>
        )}
      </button>

      <input
        ref={nativeInputRef}
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="sr-only"
        tabIndex={-1}
      />
    </div>
  );
}
