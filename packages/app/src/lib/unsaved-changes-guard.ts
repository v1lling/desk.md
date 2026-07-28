interface DirtySource {
  message: string;
  label: string;
  guardInAppNavigation: boolean;
}

const dirtySources = new Map<symbol, DirtySource>();
let allowStateChangeForCurrentClick = false;
let clickGuardInstalled = false;

function messageForUnsavedChanges(): string | undefined {
  for (const source of dirtySources.values()) {
    if (source.guardInAppNavigation) return source.message;
  }
  return undefined;
}

function handleInternalLinkClick(event: MouseEvent): void {
  if (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  ) {
    return;
  }

  const target = event.target;
  if (!(target instanceof Element)) return;
  const anchor = target.closest<HTMLAnchorElement>("a[href]");
  if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;

  const destination = new URL(anchor.href, window.location.href);
  if (destination.origin !== window.location.origin) return;
  if (
    destination.pathname === window.location.pathname &&
    destination.search === window.location.search
  ) {
    return;
  }

  const message = messageForUnsavedChanges();
  if (message === undefined) return;
  if (!window.confirm(message)) {
    event.preventDefault();
    event.stopPropagation();
    return;
  }

  // A Link may also switch project/workspace state in its React onClick handler.
  // Let that synchronous state change through without asking a second time.
  allowStateChangeForCurrentClick = true;
  queueMicrotask(() => {
    allowStateChangeForCurrentClick = false;
  });
}

function syncClickGuard(): void {
  const shouldInstall = [...dirtySources.values()].some(
    (source) => source.guardInAppNavigation,
  );
  if (shouldInstall === clickGuardInstalled) return;
  clickGuardInstalled = shouldInstall;
  if (shouldInstall) document.addEventListener("click", handleInternalLinkClick, true);
  else document.removeEventListener("click", handleInternalLinkClick, true);
}

/** Register one mounted editing surface that currently has unsaved changes. */
export function registerUnsavedChanges(
  source: symbol,
  message: string,
  label: string,
  guardInAppNavigation: boolean,
): void {
  dirtySources.set(source, { message, label, guardInAppNavigation });
  syncClickGuard();
}

/** Remove an editing surface from the global navigation guard. */
export function unregisterUnsavedChanges(source: symbol): void {
  dirtySources.delete(source);
  syncClickGuard();
}

/**
 * Synchronous guard for state-only navigation such as switching projects or workspaces.
 * Internal route links are covered by the capture-phase click guard above.
 */
export function confirmUnsavedChanges(): boolean {
  if (allowStateChangeForCurrentClick) return true;
  const message = messageForUnsavedChanges();
  return message === undefined || window.confirm(message);
}

/** Labels consumed by the native-window close dialog alongside dirty editor tabs. */
export function getUnsavedChangeLabels(): string[] {
  return [...dirtySources.values()].map((source) => source.label);
}
