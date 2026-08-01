import type { ReactNode } from "react";
import { AlertCircle, Info, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";

interface SettingsPageHeaderProps {
  title: string;
  description: string;
  icon?: ReactNode;
  children?: ReactNode;
  className?: string;
}

export function SettingsPageHeader({
  title,
  description,
  icon,
  children,
  className,
}: SettingsPageHeaderProps) {
  return (
    <header className={cn("space-y-4", className)}>
      <div className="flex items-start gap-3">
        {icon && (
          <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-card text-muted-foreground">
            {icon}
          </span>
        )}
        <div className="min-w-0 space-y-1">
          <h1 className="text-xl font-semibold tracking-tight text-foreground">{title}</h1>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        </div>
      </div>
      {children}
    </header>
  );
}

interface SettingsSectionProps {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}

export function SettingsSection({
  title,
  description,
  children,
  className,
}: SettingsSectionProps) {
  return (
    <section className={cn("space-y-3", className)}>
      <div className="space-y-1 px-1">
        <h2 className="text-sm font-medium leading-none text-foreground">{title}</h2>
        {description && (
          <p className="max-w-2xl text-[13px] leading-relaxed text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {children}
    </section>
  );
}

interface SettingsGroupProps {
  children: ReactNode;
  tone?: "default" | "danger";
  className?: string;
}

export function SettingsGroup({ children, tone = "default", className }: SettingsGroupProps) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border bg-card/80 shadow-none",
        tone === "danger" ? "border-destructive/30" : "border-border/80",
        "[&>*+*]:border-t [&>*+*]:border-border/60",
        className,
      )}
    >
      {children}
    </div>
  );
}

interface SettingsRowProps {
  label: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  htmlFor?: string;
  align?: "center" | "start";
  className?: string;
}

export function SettingsRow({
  label,
  description,
  children,
  htmlFor,
  align = "center",
  className,
}: SettingsRowProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:justify-between sm:gap-6",
        align === "center" ? "sm:items-center" : "sm:items-start",
        className,
      )}
    >
      <div className="min-w-0 flex-1 space-y-1">
        <Label htmlFor={htmlFor} className="leading-snug">
          {label}
        </Label>
        {description && (
          <p className="text-[13px] leading-relaxed text-muted-foreground">{description}</p>
        )}
      </div>
      <div className="flex w-full shrink-0 justify-end sm:w-auto">{children}</div>
    </div>
  );
}

interface SettingsFieldProps {
  children: ReactNode;
  label?: ReactNode;
  description?: ReactNode;
  footer?: ReactNode;
  htmlFor?: string;
  className?: string;
}

export function SettingsField({
  children,
  label,
  description,
  footer,
  htmlFor,
  className,
}: SettingsFieldProps) {
  return (
    <div className={cn("space-y-3 px-4 py-4", className)}>
      {(label || description) && (
        <div className="space-y-1">
          {label && (
            <Label htmlFor={htmlFor} className="leading-snug">
              {label}
            </Label>
          )}
          {description && (
            <p className="text-[13px] leading-relaxed text-muted-foreground">{description}</p>
          )}
        </div>
      )}
      {children}
      {footer && (
        <div className="text-xs leading-relaxed text-muted-foreground">{footer}</div>
      )}
    </div>
  );
}

interface SettingsNoticeProps {
  children: ReactNode;
  title?: ReactNode;
  tone?: "info" | "warning" | "error";
  className?: string;
}

const noticeToneClasses = {
  info: "border-border/80 bg-muted/35 text-muted-foreground",
  warning: "border-amber-500/25 bg-amber-500/8 text-amber-800 dark:text-amber-300",
  error: "border-destructive/25 bg-destructive/8 text-destructive",
} as const;

const noticeIcons = {
  info: Info,
  warning: TriangleAlert,
  error: AlertCircle,
} as const;

export function SettingsNotice({
  children,
  title,
  tone = "info",
  className,
}: SettingsNoticeProps) {
  const Icon = noticeIcons[tone];
  return (
    <div
      role={tone === "error" ? "alert" : undefined}
      className={cn(
        "flex items-start gap-3 rounded-lg border px-3.5 py-3",
        noticeToneClasses[tone],
        className,
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0 space-y-1 text-[13px] leading-relaxed">
        {title && <p className="font-medium text-foreground">{title}</p>}
        <div>{children}</div>
      </div>
    </div>
  );
}
