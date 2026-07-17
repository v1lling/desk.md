/**
 * Better Auth React client — hosted mode only (step 3b).
 *
 * Talks to the server's `/api/auth/*` handler (same origin → no CORS). Imported
 * only behind the `import.meta.env.VITE_DESK_HOSTED` flag (see app-shell), so the
 * Tauri desktop / browser-mock bundles never pull it in.
 */
import { createAuthClient } from "better-auth/react";

const authClient = createAuthClient({
  baseURL: window.location.origin,
});

export const { signIn, signUp, signOut, useSession } = authClient;
