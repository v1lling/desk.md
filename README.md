<p align="center">
  <img src="icon.png" alt="desk.md" width="128" height="128">
</p>

# desk.md

> Project-centric work management for freelancers and consultants.

## What is desk.md?

desk.md is a Tauri desktop app that organizes work into **workspaces** and **projects**, with all content stored as local markdown files.

## Current Direction: Assistant-First

Desk now ships with an in-app **Assistant** as the primary AI experience:

- Assistant is a chat UI with tool-calling
- Email drafting is routed through Assistant with prefilled draft turns
- Tool calls are scoped to the active workspace
- Mutations (create/update tasks, meetings, docs) require explicit approval
- Context retrieval is tool-driven via **Context Catalog** (Smart Index)
- MCP remains available for external CLI interoperability

## Tech Stack

- Frontend: React, Vite, TypeScript, Tailwind CSS
- Desktop: Tauri 2
- UI: shadcn/ui
- State: Zustand + TanStack Query
- Storage: Local markdown files under `~/Desk/`

## Quick Start

```bash
npm install
npm run dev
npm run tauri dev
```

## Documentation

- [docs/FEATURES.md](./docs/FEATURES.md)
- [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)
- [docs/EMAIL-INTEGRATION.md](./docs/EMAIL-INTEGRATION.md)
- [docs/MCP_INTEGRATION.md](./docs/MCP_INTEGRATION.md)

## Data Storage

Desk stores user data in `~/Desk/workspaces/*` and app metadata in `~/Desk/.desk/`.

## License

Private project.
