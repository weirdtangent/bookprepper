/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DEBUG_MODE?: string;
  readonly VITE_ADMIN_EMAIL?: string;
}

declare const __APP_VERSION__: string;
