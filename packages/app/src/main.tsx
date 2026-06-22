import "@fontsource-variable/geist";
import "@fontsource-variable/geist-mono";
import "./app/globals.css";
// i18n init runs as a side-effect on import — must precede modules that read
// translations at module-eval time (e.g. src/lib/design-tokens.ts).
import "./i18n";
import { Buffer as BufferPolyfill } from "buffer";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

// gray-matter — used by every Markdown parse (parseMarkdown) — calls
// `Buffer.from()` at runtime. The Tauri/browser WebView has no Node `Buffer`
// global, so provide one. Without this, every workspace/task/doc/meeting parse
// throws "Buffer is not defined" and the app silently shows no data.
if (typeof globalThis.Buffer === "undefined") {
  globalThis.Buffer = BufferPolyfill as unknown as typeof globalThis.Buffer;
}

async function bootstrap() {
  // Wire the @desk/core host seams before any domain call. The domain layer is
  // UI-agnostic (it runs on a server too); these injectors connect it to this
  // app's stores. The data-root resolver MUST be set before expandFsScope()
  // below, since that resolves the data path through it.
  const { setDataRootResolver } = await import("@desk/core");
  const { useBootStore } = await import("./stores/boot");
  setDataRootResolver(async () => useBootStore.getState().dataPath || "~/Desk");

  // Set the Tauri FS scope BEFORE any store module is evaluated. Zustand
  // `persist` stores backed by createFileStorage read the filesystem during
  // hydration at module-eval time — that must happen after the scope is set,
  // otherwise the narrowed capability denies the read and the store hydrates
  // empty. expandFsScope() is a no-op in browser mode (isTauri() guard inside).
  const { expandFsScope } = await import("@desk/core");
  try {
    await expandFsScope(); // no arg → getDeskPath() → data-root resolver → boot store
  } catch (error) {
    // Never block launch on a scope failure — fs calls will just be denied,
    // and createFileStorage.getItem already catches & returns null.
    console.error("[Desk] expandFsScope failed at bootstrap:", error);
  }

  // Wire the remaining seams (only needed once writes happen): editor-sync
  // notifications and external-agent file generation.
  const { setEditorNotifier, setAgentContextWriter } = await import("@desk/core");
  const { useOpenEditorRegistry } = await import("./stores/open-editor-registry");
  setEditorNotifier({
    isOpen: (p) => useOpenEditorRegistry.getState().isOpen(p),
    updateLastSaved: (p, c) => useOpenEditorRegistry.getState().updateLastSaved(p, c),
    handlePathDeleted: (p) => useOpenEditorRegistry.getState().handlePathDeleted(p),
    handlePathChange: (o, n) => useOpenEditorRegistry.getState().handlePathChange(o, n),
  });
  const { writePerWorkspaceAgentFiles, writeTopLevelAgentFiles } = await import(
    "./lib/context-index/agent-context"
  );
  setAgentContextWriter({
    writePerWorkspace: writePerWorkspaceAgentFiles,
    writeTopLevel: writeTopLevelAgentFiles,
  });

  // Hosted mode (step 3a): when this bundle is built for the server
  // (VITE_DESK_HOSTED=1, via `npm run build:hosted`), the domain runs on the
  // server — inject a RemoteDeskService so every getDeskService() call goes over
  // HTTP instead of the in-process LocalDeskService. The default builds (Tauri
  // desktop, browser mock) leave the flag unset and keep running the domain
  // locally. Same-origin → no CORS.
  if (import.meta.env.VITE_DESK_HOSTED) {
    const { setDeskService } = await import("@desk/core");
    const { createRemoteDeskService } = await import("./lib/remote-desk-service");
    setDeskService(createRemoteDeskService(window.location.origin));
  }

  // Dynamic import: the App module graph (and every store with persist) is
  // only evaluated now, after the FS scope is in place.
  const { App } = await import("./app");

  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}

bootstrap();
