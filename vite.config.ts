import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

const pkg = JSON.parse(readFileSync("./package.json", "utf8")) as {
  version: string;
};

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
  define: {
    "process.env.NODE_ENV": JSON.stringify(
      process.env.NODE_ENV ?? "development"
    ),
    __APP_VERSION__: JSON.stringify(pkg.version),
    __GIT_COMMIT__: JSON.stringify(commit),
    __BUILD_TIME__: JSON.stringify(buildTime),
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
