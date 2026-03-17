import { StatePanel } from "./state-panel";

interface LoadingStateProps {
  label?: string;
  className?: string;
  display?: "card" | "inline";
}

export function LoadingState({ label = "content", className, display }: LoadingStateProps) {
  return (
    <StatePanel
      variant="loading"
      title={`Loading ${label}...`}
      display={display}
      className={className}
    />
  );
}
