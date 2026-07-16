# Self-hosting desk.md

Run desk.md on a server you control. One container serves it all:

- the **web/PWA app** (use desk.md from any browser, installable on phone/tablet),
- the **domain API** the web and native clients talk to,
- the **OAuth 2.1 Authorization Server**, and
- a read-only **MCP endpoint** so AI tools (Claude.ai, ChatGPT, Claude Code) can connect.

Your data stays plain Markdown on the server's disk — browse it, back it up, own it.

## Quick start

```bash
cd deploy
cp .env.example .env
# set BETTER_AUTH_SECRET (openssl rand -base64 33)
docker compose up -d
```

Open <http://localhost:8787> and create your account — **the first sign-up wins** (the
deployment is single-account by default; the same login also gates AI connectors). Check
health with `curl localhost:8787/health` → `{"ok":true}`.

This builds the image from the repo's root `Dockerfile`. Data lives in `./data` (override
with `DESK_DATA_DIR`).

## Production: put it behind HTTPS

A real deployment needs TLS — OAuth, the MCP connectors, and Secure cookies all require
`https`. Terminate TLS in a reverse proxy, forward to the container, and set
`DESK_PUBLIC_URL` to the public URL (it must match exactly: cookies and the OAuth/MCP
audience derive from it).

Any proxy works (Traefik, nginx, Caddy, Nginx Proxy Manager). Minimal **Caddy** example —
Caddy fetches the certificate automatically:

```
desk.example.com {
    reverse_proxy localhost:8787
}
```

Then set `DESK_PUBLIC_URL=https://desk.example.com` in `.env` and restart. MCP streams
responses, so if your proxy buffers, disable buffering and raise read/send timeouts for the
`/mcp` path.

> **If your proxy has a WAF, don't let it block `http://` in the query string.** Native OAuth
> clients (the Claude Code VSCode extension, MCP Inspector, etc.) sign in with an RFC 8252
> loopback redirect, so the authorize URL carries `redirect_uri=http://localhost:<port>/callback`.
> Many WAF rulesets (e.g. Nginx Proxy Manager's "Block Common Exploits", OWASP CRS RFI/SSRF
> rules) flag a `http://` URL in a parameter and return 403 — breaking sign-in before it reaches
> desk.md. Disable that rule for this host; desk.md validates the `redirect_uri` itself.

## Connect AI over MCP

Once it's on a public HTTPS URL, add `https://desk.example.com/mcp` as a custom connector in
Claude.ai or ChatGPT (or point Claude Code at it via `mcp-remote`). The client self-registers,
sends you through sign-in + consent, and then has **read-only** access:
`desk_workspace_info`, `desk_tree`, `desk_read`, `desk_search`, `desk_catalog`. No static API
key to manage — it's the standard OAuth grant.

> Don't put the server behind a separate SSO/zero-trust gate (Cloudflare Access, etc.).
> desk.md's own OAuth is the access control; an extra login in front breaks the connector grant.

## Server-side AI

Add `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` to `.env` and the server runs the AI maintenance
itself: Smart Index summaries and each project's Current state file stay fresh as records
change, with no desktop app involved — hosted web clients get the full Smart Index. Setting a
key is your consent to send file previews to that provider. Provider and model selection come
from the shared app settings (Settings → AI in any client); without a key everything still
works, files just carry metadata without AI summaries.

## Use the desktop app against your server

The native desktop app can point at your server instead of local disk (Settings →
Connection, or the first-run wizard). It works against the deployment with no extra config.
For developing the client from source against a live server (`npm run tauri:dev`), add
`DESK_TRUSTED_ORIGINS=http://localhost:3001` to `.env`.

## Environment

See [.env.example](.env.example) for the full list. Required: `BETTER_AUTH_SECRET`. For
production also set `DESK_PUBLIC_URL`. Optional: `DESK_DATA_DIR`, `DESK_PORT`,
`DESK_TRUSTED_ORIGINS`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`.

---

Host-specific deploy scripts and configs (e.g. a personal NAS) live in `deploy/local/`,
which is gitignored — keep machine-specific bits out of the repo and reuse the root
`Dockerfile` + the generic compose here.
