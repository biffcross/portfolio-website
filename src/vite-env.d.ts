/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CUSTOM_DOMAIN: string
  readonly VITE_R2_PUBLIC_URL: string
  readonly VITE_R2_ACCESS_KEY_ID: string
  readonly VITE_R2_SECRET_ACCESS_KEY: string
  readonly VITE_R2_API_TOKEN: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}