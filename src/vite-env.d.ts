/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Full commit hash the build was made from, see vite.config.ts. */
  readonly VITE_BUILD_COMMIT: string | undefined
  /** When the build was made, as an ISO timestamp. */
  readonly VITE_BUILD_TIME: string | undefined
}
