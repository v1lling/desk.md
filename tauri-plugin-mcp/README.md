# tauri-plugin-mcp (stub)

This is a **no-op stub** so Cargo can resolve dependencies in CI and production builds.

## Why this exists

Cargo resolves ALL dependencies (including optional ones) during `cargo metadata`. The real `tauri-plugin-mcp` plugin lives in a local directory outside this repo, so CI would fail without this stub.

## How it works

- The MCP plugin is behind a Cargo feature flag: `--features mcp`
- **CI / production build**: no `--features mcp` → stub is resolved but never compiled
- **Local dev**: `npm run tauri:dev` passes `--features mcp` → stub gets compiled (its API matches the real plugin)

## Using the real plugin locally

If you have the real plugin at `/Users/sascha/Development/tauri-plugin-mcp`, you can **replace this stub with a symlink** for full MCP support in dev:

```bash
rm -rf tauri-plugin-mcp
ln -s /Users/sascha/Development/tauri-plugin-mcp tauri-plugin-mcp
```

Both the stub and the real plugin work with `npm run tauri:dev` — the stub just does nothing.
