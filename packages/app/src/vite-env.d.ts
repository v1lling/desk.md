/// <reference types="vite/client" />

declare const __APP_VERSION__: string;
declare const __GIT_COMMIT__: string;
declare const __BUILD_TIME__: string;

interface ImportMetaEnv {
  /** Set to "1" by `npm run build:hosted` — selects RemoteDeskService at boot. */
  readonly VITE_DESK_HOSTED?: string;
}
