/**
 * Native hosted-mode HTTP transport (step 3b-native).
 *
 * Re-exports the `@tauri-apps/plugin-http` fetch — a drop-in for the web `fetch` whose
 * request runs in Rust (reqwest), not in the webview. That matters for two reasons:
 *   1. It is NOT a browser fetch, so it bypasses the webview CSP `connect-src` and the
 *      browser CORS preflight — the native app can reach an arbitrary user-chosen server
 *      origin without widening the CSP or adding server CORS for `tauri://localhost`.
 *   2. The reachable origins are governed instead by the `http:default` scope in
 *      src-tauri/capabilities/default.json.
 *
 * Imported only from code paths reached inside a Tauri webview (main.tsx / the native
 * auth client), gated for bundling behind `!VITE_DESK_HOSTED`, so the web/PWA build
 * never pulls it in. It runs but lies dormant in the browser-mock dev bundle.
 */
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";

export const nativeFetch: typeof fetch = tauriFetch as typeof fetch;
