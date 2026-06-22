import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

const pkg = JSON.parse(readFileSync("./package.json", "utf8")) as {
  version: string;
};

// Resolve the @desk/core workspace package straight to its TypeScript source so
// Vite compiles it as part of the app (no build step, no node_modules pre-bundle
// quirks). The `/types` subpath alias must come first so it wins over the bare
// one. The monorepo root is added to server.fs.allow because core lives outside
// this package's root.
const monorepoRoot = fileURLToPath(new URL("../..", import.meta.url));
const coreSrc = fileURLToPath(new URL("../core/src/index.ts", import.meta.url));
const coreTypesSrc = fileURLToPath(new URL("../core/src/types/index.ts", import.meta.url));

let commit = "dev";
try {
  commit = execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] })
    .toString()
    .trim();
} catch {
  // no git / shallow clone — leave as "dev"
}

const buildTime = new Date().toISOString();

export default defineConfig({
  base: "./",
  plugins: [react(), tsconfigPaths()],
  resolve: {
    alias: {
      "@desk/core/types": coreTypesSrc,
      "@desk/core": coreSrc,
    },
  },
  define: {
    "process.env.NODE_ENV": JSON.stringify(
      process.env.NODE_ENV ?? "development"
    ),
    __APP_VERSION__: JSON.stringify(pkg.version),
    __GIT_COMMIT__: JSON.stringify(commit),
    __BUILD_TIME__: JSON.stringify(buildTime),
  },
  server: { port: 3001, fs: { allow: [monorepoRoot] } },
  esbuild: {
    // Strip debug logging from production builds. console.warn/error are kept
    // for real diagnostics. No-op during `vite dev` — dead-code elimination
    // only runs when the build is minified.
    pure: ["console.log", "console.debug", "console.info", "console.trace"],
  },
  build: { outDir: "dist" },
});
