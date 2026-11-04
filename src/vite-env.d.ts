/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_APP_URL?: string;
  readonly VITE_BASE_PATH?: string;
  /** "Try the live demo" target, e.g. https://demo.ohshifts.com (defaults to /demo). */
  readonly VITE_DEMO_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
