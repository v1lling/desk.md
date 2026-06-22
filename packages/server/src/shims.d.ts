/**
 * Ambient shim for Vite asset-URL imports reached through @desk/core's
 * browser-only converters (e.g. pdf.js worker `...?url`). These imports are
 * lazy and never execute on the server, but tsc resolves the static specifier
 * when it type-checks the imported core source. Mirrors core's own shim so the
 * server program can resolve it too.
 */
declare module "*?url" {
  const url: string;
  export default url;
}
