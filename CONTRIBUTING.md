# Contributing to Desk

Thanks for your interest in contributing to Desk — a local-first work
management app where everything is stored as plain Markdown files you own.

## Ways to contribute

- **Report bugs** — open an [issue](../../issues/new/choose) with steps to reproduce.
- **Suggest features** — open an issue describing the problem you want solved.
- **Submit code** — fix a bug or build a feature via a pull request.
- **Improve docs** — corrections and clarifications are always welcome.

## Development setup

### Prerequisites

- **Node.js 22 LTS.** Newer versions (24+) currently break Rollup's optional
  native dependency — please use Node 22.
- **Rust** (stable) and the [Tauri prerequisites](https://tauri.app/start/prerequisites/)
  for your OS — only needed to run/build the desktop app.

### Getting started

```bash
npm install

npm run dev          # Browser with mock data (port 3001) — fastest loop, no Rust needed
npm run tauri:dev    # Desktop app with real file system access
```

Browser mode (`npm run dev`) runs against mock data and is enough for most
UI work. Use `npm run tauri:dev` when you need real file system behavior.

## Before opening a pull request

Run both of these and make sure they pass:

```bash
npm run lint         # ESLint
npm run build        # Type-check + production build (tsc -b && vite build)
```

CI runs the same checks on every pull request.

## Pull request guidelines

- Branch off `main` and open your PR against `main`.
- Keep PRs focused — one logical change per PR is much easier to review.
- Use [Conventional Commits](https://www.conventionalcommits.org/) for commit
  messages, matching the existing history, e.g.:
  - `feat(meetings): add recurring meeting support`
  - `fix(watcher): normalize paths on Windows`
  - `refactor(assistant): extract tool orchestrator`
  - `chore(deps): bump tauri to 2.10`
- Update documentation when you change behavior.

## Project layout

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the full structure, file
paths, and design decisions. [CLAUDE.md](CLAUDE.md) also contains a detailed
overview of conventions and key directories.

## Code of Conduct

This project follows the [Contributor Covenant](CODE_OF_CONDUCT.md). By
participating, you agree to uphold it.

## License

By contributing, you agree that your contributions will be licensed under the
same license as this project (see [LICENSE](LICENSE)).
