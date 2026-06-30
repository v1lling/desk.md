/**
 * Ambient declarations for Vite asset-URL imports used by browser-only
 * converters (e.g. file-conversion/converters/pdf.ts loads the pdf.js worker
 * via `...?url`). These are resolved by Vite when the app bundles core; the
 * imports are lazy and never execute on the Node server. This shim lets core
 * type-check standalone without depending on `vite/client`.
 */
declare module "*?url" {
  const url: string;
  export default url;
}
