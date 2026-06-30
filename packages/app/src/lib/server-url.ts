/**
 * Normalize a user-typed desk.md server URL (step 3b-native).
 *
 * Accepts inputs like "nas.example", "https://nas.example/" and returns a clean origin
 * ("https://nas.example") with a default https:// scheme and no trailing slash. Returns
 * null if the input can't be parsed as a URL, OR if it uses an explicit http:// scheme —
 * the Keychain bearer token rides every request, so a plaintext server would leak it.
 * (A scheme-less input is upgraded to https, so only an explicit "http://" is rejected.)
 */
export function normalizeServerUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }
  // Default to https when the user omits the scheme (the common case behind Caddy).
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(withScheme);
    // https only: an http:// origin would send the session token in cleartext.
    if (url.protocol !== "https:") {
      return null;
    }
    // origin drops any path/query/hash and the trailing slash.
    return url.origin;
  } catch {
    return null;
  }
}
