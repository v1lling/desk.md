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
  // Set the Tauri FS scope BEFORE any store module is evaluated. Zustand
  // `persist` stores backed by createFileStorage read the filesystem during
  // hydration at module-eval time — that must happen after the scope is set,
  // otherwise the narrowed capability denies the read and the store hydrates
  // empty. expandFsScope() is a no-op in browser mode (isTauri() guard inside).
  const { expandFsScope } = await import("./lib/desk/tauri-fs");
  try {
    await expandFsScope(); // no arg → getDeskPath() → useBootStore.dataPath || "~/Desk"
  } catch (error) {
    // Never block launch on a scope failure — fs calls will just be denied,
    // and createFileStorage.getItem already catches & returns null.
    console.error("[Desk] expandFsScope failed at bootstrap:", error);
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
