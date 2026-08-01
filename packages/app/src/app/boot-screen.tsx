import { useTranslation } from "react-i18next";

/**
 * The one branded loading surface used before Desk is interactive.
 *
 * Keep the mark and its motion isolated here so the startup treatment can be
 * refined without touching bootstrap, authentication, or routing code.
 */
export function AppBootScreen() {
  const { t } = useTranslation();

  return (
    <div
      className="flex h-screen w-screen items-center justify-center overflow-hidden bg-background"
      role="status"
      aria-live="polite"
    >
      <img
        src="/icon.png"
        alt=""
        className="desk-boot-mark size-14 rounded-[14px]"
        draggable={false}
      />
      <span className="sr-only">{t("common.buttons.loading")}</span>
    </div>
  );
}
