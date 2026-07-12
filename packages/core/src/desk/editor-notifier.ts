/**
 * Editor-notifier seam.
 *
 * After a write/delete/move, the domain notifies open editor tabs so they don't
 * mistake our own save for an external change. On a server there are no editors,
 * so the default is a no-op. The app wires this to the open-editor registry.
 *
 * Mirrors the storage/service registries (the set/get registry pattern).
 */
export interface EditorNotifier {
  isOpen(path: string): boolean;
  updateLastSaved(path: string, content: string): void;
  handlePathDeleted(path: string): void;
  handlePathChange(oldPath: string, newPath: string): void;
}

const NOOP: EditorNotifier = {
  isOpen: () => false,
  updateLastSaved: () => {},
  handlePathDeleted: () => {},
  handlePathChange: () => {},
};

let notifier: EditorNotifier = NOOP;

export function setEditorNotifier(n: EditorNotifier): void {
  notifier = n;
}

export function getEditorNotifier(): EditorNotifier {
  return notifier;
}
