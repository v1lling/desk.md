import "@fontsource-variable/geist";
import "@fontsource-variable/geist-mono";
import "./app/globals.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

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
