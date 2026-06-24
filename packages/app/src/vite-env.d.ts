/// <reference types="vite/client" />

declare const __APP_VERSION__: string;
declare const __GIT_COMMIT__: string;
declare const __BUILD_TIME__: string;

interface ImportMetaEnv {
  /**
   * Set to "1" by `npm run build:hosted` (the server's web/PWA build) — selects the
   * same-origin cookie RemoteDeskService at boot. When unset (the default `build`, used
   * by the Tauri desktop app and the browser-mock dev preview), native hosted-mode code
   * is bundled and lit up at runtime by isTauri(); see main.tsx / app-shell.tsx.
   */
  readonly VITE_DESK_HOSTED?: string;
}
