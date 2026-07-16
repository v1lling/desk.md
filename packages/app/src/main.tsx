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

  // Set the Tauri FS scope BEFORE any store module is evaluated. File-backed
  // zustand stores (createRemoteSettingStorage & co.) read the filesystem during
  // hydration at module-eval time — that must happen after the scope is set,
  // otherwise the narrowed capability denies the read and the store hydrates
  // empty. expandFsScope() is a no-op in browser mode (isTauri() guard inside).
  const { expandFsScope } = await import("@desk/core");
  try {
    await expandFsScope(); // no arg → getDeskPath() → data-root resolver → boot store
  } catch (error) {
    // Never block launch on a scope failure — fs calls will just be denied,
    // and the file-backed store adapters already catch & return null.
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

  // AI key seam: the app resolves provider keys from the OS Keychain. Outside Tauri the
  // secrets module throws BrowserModeError — mapped to "no key", which every caller handles.
  const { setAIKeyResolver } = await import("@desk/core");
  setAIKeyResolver(async (ref) => {
    try {
      const { getSecret } = await import("./lib/ai/secrets");
      return await getSecret(ref);
    } catch {
      return null;
    }
  });

  // Hosted mode (step 3a): when this bundle is built for the server
  // (VITE_DESK_HOSTED=1, via `npm run build:hosted`), the domain runs on the
  // server — inject a RemoteDeskService so every getDeskService() call goes over
  // HTTP instead of the in-process LocalDeskService. Same-origin → cookie auth, no CORS.
  if (import.meta.env.VITE_DESK_HOSTED) {
    const { setDeskService, setStorage, GuardStorageProvider } = await import("@desk/core");
    const { createRemoteDeskService } = await import("./lib/remote-desk-service");
    // Domain runs on the server: make the local filesystem structurally off-limits so a
    // stray getStorage() throws instead of silently hitting the wrong disk.
    setStorage(new GuardStorageProvider());
    setDeskService(createRemoteDeskService(window.location.origin));
  } else {
    // Native hosted mode (step 3b-native): the same Tauri app can point at a remote
    // desk.md server instead of local disk. "Native" is detected at runtime via
    // isTauri() — true on every Tauri desktop platform (macOS/Windows/Linux) — so no
    // build flag is needed; the DMG/MSI/AppImage is always native. This whole branch is
    // the `else` of the constant `VITE_DESK_HOSTED`, so it's tree-shaken from the lean
    // web/PWA build. The choice is a runtime boot-store setting, so flipping it +
    // reloading re-wires the service; requests go through the Tauri HTTP plugin (Rust
    // reqwest, bypasses CSP/CORS) with a Keychain-backed Bearer token. Local mode (and
    // the browser-mock dev build, where isTauri() is false) keeps LocalDeskService.
    const { isTauri } = await import("@desk/core");
    const boot = useBootStore.getState();
    if (isTauri() && boot.connectionMode === "remote" && boot.serverUrl) {
      const { setDeskService, setStorage, GuardStorageProvider } = await import("@desk/core");
      const { createRemoteDeskService } = await import("./lib/remote-desk-service");
      const { nativeFetch } = await import("./lib/native-http");
      const { loadSessionToken, getTokenHeaderSync } = await import("./lib/session-token");
      await loadSessionToken(); // populate the in-memory mirror before any RPC
      // Domain runs on the server: guard the local filesystem (see hosted branch above).
      setStorage(new GuardStorageProvider());
      setDeskService(
        createRemoteDeskService(boot.serverUrl, {
          fetchImpl: nativeFetch,
          authHeader: getTokenHeaderSync,
        })
      );
    }
  }

  // AI maintenance runs where the data lives: start the engine only when this app owns the
  // data (local disk). In remote mode the server runs it. No-ops internally otherwise.
  const { startAppMaintenanceEngine } = await import("./lib/maintenance");
  await startAppMaintenanceEngine();

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
