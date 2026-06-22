import { useTranslation } from "react-i18next";
import { StatePanel } from "./state-panel";

interface LoadingStateProps {
  label?: string;
  className?: string;
  display?: "card" | "inline";
}

export function LoadingState({ label, className, display }: LoadingStateProps) {
  const { t } = useTranslation();
  const resolvedLabel = label ?? t("ui.loadingState.defaultLabel");
  return (
    <StatePanel
      variant="loading"
      title={t("ui.loadingState.title", { label: resolvedLabel })}
      display={display}
      className={className}
    />
  );
}
