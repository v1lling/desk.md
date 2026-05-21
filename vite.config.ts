import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  base: "./",
  plugins: [react(), tsconfigPaths()],
  define: {
    "process.env.NODE_ENV": JSON.stringify(
      process.env.NODE_ENV ?? "development"
    ),
  },
  server: { port: 3001 },
  esbuild: {
    // Strip debug logging from production builds. console.warn/error are kept
    // for real diagnostics. No-op during `vite dev` — dead-code elimination
    // only runs when the build is minified.
    pure: ["console.log", "console.debug", "console.info", "console.trace"],
  },
  build: { outDir: "dist" },
});
