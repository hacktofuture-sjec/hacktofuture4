/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_RED_API_URL?: string;
  readonly VITE_RED_WS_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
