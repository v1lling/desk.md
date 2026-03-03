import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import { nodePolyfills } from "vite-plugin-node-polyfills";

export default defineConfig({
  base: "./",
  plugins: [
    react(),
    tsconfigPaths(),
    nodePolyfills({
      include: ["buffer", "process"],
      globals: { Buffer: true, process: true },
    }),
  ],
  server: { port: 3001 },
  build: { outDir: "dist" },
});
