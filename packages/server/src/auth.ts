/**
 * Better Auth instance — first-party human login for the hosted tier (step 3b).
 *
 * Owns the security-sensitive parts (password hashing, sessions, CSRF, endpoint
 * throttling) and a few SQLite tables. The markdown stays on the filesystem; this
 * SQLite file is the derived auth store, at `$DESK_DATA_ROOT/.desk/auth.sqlite`
 * (override with DESK_AUTH_DB), consistent with the `.desk/` metadata convention.
 *
 * Login method: email+password, enabled. Social/OIDC providers are wired but
 * gated on env (off by default). Registration uses "first user wins" — sign-up is
 * allowed only while the user table is empty, then auto-closes forever. No admin
 * script, no env password.
 *
 * Schema: the auth tables are created at boot by `migrateAuth()` (see index.ts),
 * so no manual `@better-auth/cli migrate` step is needed on a fresh deployment.
 */
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import Database from "better-sqlite3";
import { betterAuth } from "better-auth";
import type { BetterAuthOptions } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { bearer } from "better-auth/plugins/bearer";
import { jwt } from "better-auth/plugins/jwt";
import { oauthProvider } from "@better-auth/oauth-provider";
import { getMigrations } from "better-auth/db/migration";
import { resolveDataRoot } from "./boot";

function authDbPath(): string {
  return process.env.DESK_AUTH_DB ?? join(resolveDataRoot(), ".desk", "auth.sqlite");
}

const dbPath = authDbPath();
mkdirSync(dirname(dbPath), { recursive: true });
const db = new Database(dbPath);

/**
 * True once at least one account exists. Used by the first-run gate (client picks
 * the create-account vs login screen) and by the sign-up hook.
 */
export async function hasUsers(): Promise<boolean> {
  try {
    const row = db.prepare("SELECT COUNT(*) AS n FROM user").get() as { n: number };
    return row.n > 0;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // Pre-migration only: the `user` table doesn't exist yet → genuinely no users,
    // so the client shows the create-account screen. With boot-time auto-migration
    // (migrateAuth) this branch is effectively dead at runtime; kept as a safety net.
    if (message.includes("no such table")) {
      return false;
    }
    // Any other error (e.g. SQLITE_BUSY) must fail CLOSED: report "users exist" so a
    // transient blip can neither let a second sign-up through the before-hook nor
    // flash the create-account screen on a live deployment. This matches the client's
    // own fail-safe (hosted-auth-gate treats a status-fetch error as "users exist").
    console.error("[auth] hasUsers() check failed; treating as users-exist:", err);
    return true;
  }
}

// In production, DESK_PUBLIC_URL is load-bearing for three things at once — the
// Better Auth baseURL, the Secure cookie flag, and the /api/desk origin allowlist.
// Forgetting it doesn't crash; it fails closed in an opaque way (every RPC 403s,
// cookie misconfigured). Assert it so one missing env is one clear boot error, not
// a "works locally, 403s in Docker" mystery. Mirrors the secret guard below.
if (process.env.NODE_ENV === "production" && !process.env.DESK_PUBLIC_URL) {
  throw new Error(
    "DESK_PUBLIC_URL must be set in production (baseURL, secure cookies, and the RPC origin allowlist all derive from it)."
  );
}

export const baseURL = process.env.DESK_PUBLIC_URL ?? `http://localhost:${process.env.PORT ?? 8787}`;

// The OAuth issuer + JWKS URL (Better Auth serves the AS under its /api/auth base path).
// Exported so the MCP resource server can verify access tokens against this issuer/keys.
export const OAUTH_ISSUER = `${baseURL}/api/auth`;
export const OAUTH_JWKS_URL = `${baseURL}/api/auth/jwks`;

// Fail fast in production rather than silently signing sessions with Better Auth's
// generated dev secret (which rotates on every restart → everyone logged out, and
// is not meant for production). Mirrors boot.ts's throw-on-bad-config posture.
const secret = process.env.BETTER_AUTH_SECRET;
if (!secret) {
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "BETTER_AUTH_SECRET must be set in production (a stable random secret signs the session cookies)."
    );
  }
  console.warn(
    "[auth] BETTER_AUTH_SECRET is unset — using a generated dev secret; sessions won't survive a restart. Set BETTER_AUTH_SECRET for a stable secret."
  );
}

// Secure cookies require HTTPS; localhost (http) must not set `Secure` or the cookie
// is silently dropped. Driven off the public URL so prod (behind Caddy, https) opts in.
const isHttps = baseURL.startsWith("https:");

// Canonical URI of the MCP resource server (RFC 8707). The OAuth AS only mints access
// tokens whose audience is in `validAudiences` (below), and the MCP route verifies the
// token's audience equals this — so a token minted for the web app can't be replayed at
// /mcp and vice-versa. Exported so the MCP route + protected-resource metadata reuse it.
export const MCP_RESOURCE = `${baseURL}/mcp`;

// The shipped desktop app's fixed Tauri origins. Always trusted: a browser can't forge these
// and no cookie is scoped to them, so this doesn't widen the web tier's CSRF surface — and it
// lets the distributed app reach any deployment with no config. (macOS/Linux use
// tauri://localhost; Windows uses http(s)://tauri.localhost.)
const DESKTOP_APP_ORIGINS = ["tauri://localhost", "http://tauri.localhost", "https://tauri.localhost"];

// Extra origins the operator opts into (comma-separated DESK_TRUSTED_ORIGINS). Main use:
// http://localhost:3001 so `npm run tauri:dev` (the Vite dev port) can log in against a live
// server. Empty in normal production, keeping the deployment locked to its own origin + the app.
const EXTRA_TRUSTED_ORIGINS = (process.env.DESK_TRUSTED_ORIGINS ?? "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

// Origins trusted beyond baseURL (which Better Auth trusts implicitly). Shared by the Better
// Auth origin/CSRF check (trustedOrigins below) AND the /api/desk RPC allowlist (desk-api.ts).
export const TRUSTED_ORIGINS = [...DESKTOP_APP_ORIGINS, ...EXTRA_TRUSTED_ORIGINS];

/**
 * The Better Auth options, named so `betterAuth()` and `getMigrations()` share one
 * source of truth (the migration runner derives the schema from the same config).
 */
const authOptions = {
  database: db,
  baseURL,
  secret,
  // Trusted beyond baseURL (auto-trusted): the desktop app's Tauri origins + any
  // DESK_TRUSTED_ORIGINS. Without this, a native sign-in POST is rejected "Invalid origin".
  trustedOrigins: TRUSTED_ORIGINS,
  emailAndPassword: {
    enabled: true,
  },
  // Bearer-token sessions for the cross-origin native client (step 3b-native). The
  // Tauri webview (origin tauri://localhost) can't carry the same-origin SameSite=Lax
  // cookie, so the native app reads the session token from the `set-auth-token`
  // response header at sign-in, stores it in the macOS Keychain, and sends it as
  // `Authorization: Bearer <token>`. `getSession()` then resolves it exactly like the
  // cookie — the existing /api/desk session gate works unchanged. The web/PWA tier
  // keeps using the cookie; this is purely additive.
  plugins: [
    bearer(),
    // JWKS-backed signing keys for the OAuth AS (publishes /jwks; signs ID + JWT access
    // tokens). Required by the oauthProvider plugin below.
    jwt(),
    // OAuth 2.1 Authorization Server (Better Auth's newer, non-deprecating plugin). This is
    // the "direct OAuth" front door the Claude.ai / ChatGPT custom-connector UIs require:
    // it serves the discovery metadata, Dynamic Client Registration, auth-code + PKCE(S256),
    // consent, and the token endpoint. Step 4+5 (MCP front door) sits behind it.
    oauthProvider({
      loginPage: "/sign-in",
      consentPage: "/oauth/consent",
      // Claude/ChatGPT are unknown clients, so they MUST self-register (RFC 7591).
      // Unauthenticated DCR mints PKCE-protected public clients; the human still
      // authenticates at the authorize step, so an open /register isn't an auth bypass.
      allowDynamicClientRegistration: true,
      allowUnauthenticatedClientRegistration: true,
      // Only mint tokens whose audience is the MCP resource (RFC 8707). baseURL stays valid
      // for the AS's own userinfo. Without this the token request fails "requested resource
      // invalid" the moment a client sends the spec-required `resource` parameter.
      validAudiences: [baseURL, MCP_RESOURCE],
    }),
  ],
  // Pin the cookie posture explicitly so an upstream default change can't silently
  // widen it. SameSite=Lax also neutralizes CSRF on the same-origin /api/desk POSTs;
  // httpOnly keeps the session token out of reach of any JS (XSS can't read it).
  advanced: {
    defaultCookieAttributes: {
      httpOnly: true,
      sameSite: "lax",
      secure: isHttps,
    },
  },
  hooks: {
    // "First user wins": reject email sign-up once any account exists. Social
    // sign-up is off by default; when enabled later, extend this matcher.
    // The hasUsers()-then-insert window is a benign TOCTOU at single-user scale —
    // the user table's UNIQUE email already blocks the same-email race, and two
    // *different* first sign-ups racing is a non-issue for a personal deployment.
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path === "/sign-up/email" && (await hasUsers())) {
        throw new APIError("FORBIDDEN", {
          message: "Registration is closed: an account already exists.",
        });
      }
      // Default the RFC 8707 `resource` at the token endpoint. Better Auth only mints an
      // audience-bound JWT access token when the request carries a `resource` (otherwise it
      // issues an OPAQUE token, verifiable only by introspection). The MCP spec says clients
      // MUST send `resource`, but real clients don't always (MCP Inspector omits it), so their
      // token comes back opaque and the /mcp JWKS verifier rejects it ("no token payload").
      // This AS exists solely to guard the one MCP resource, so when no resource is supplied we
      // bind the token to MCP_RESOURCE — making every access token a JWT the resource server can
      // verify locally via JWKS, no introspection credentials needed. A client that DOES send a
      // (valid) resource is left untouched.
      if (ctx.path === "/oauth2/token" && ctx.body && !ctx.body.resource) {
        return { context: { body: { ...ctx.body, resource: MCP_RESOURCE } } };
      }
    }),
  },
} satisfies BetterAuthOptions;

export const auth = betterAuth(authOptions);

/**
 * Create/upgrade the Better Auth tables at boot (idempotent). Replaces the manual
 * `@better-auth/cli migrate` step so a fresh deployment (e.g. `docker compose up`)
 * just works — without it, the first sign-up would 500 against a missing `user`
 * table. The migration is diff-based and additive (creates what's missing, never
 * drops); the derived auth.sqlite is wipeable if it ever needs a reset.
 */
export async function migrateAuth(): Promise<void> {
  const { toBeCreated, toBeAdded, runMigrations } = await getMigrations(authOptions);
  if (toBeCreated.length === 0 && toBeAdded.length === 0) {
    return; // schema already current
  }
  await runMigrations();
  const created = toBeCreated.map((t) => t.table).join(", ") || "none";
  const altered = toBeAdded.map((t) => t.table).join(", ") || "none";
  console.log(`[auth] applied schema migrations (created: ${created}; altered: ${altered})`);
}
