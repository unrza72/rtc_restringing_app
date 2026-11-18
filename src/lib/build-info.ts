/**
 * Which build is running, baked in by vite.config.ts. Outside a Vite build
 * (tsx scripts) both are missing, hence the fallbacks.
 */
export const BUILD_COMMIT: string =
  import.meta.env.VITE_BUILD_COMMIT ?? 'unknown'
export const BUILD_TIME: string | null = import.meta.env.VITE_BUILD_TIME ?? null

/** The 7-character form git itself shows, keeping a "-dirty" suffix. */
export function shortCommit(commit: string) {
  const [hash, suffix] = commit.split('-')
  return /^[0-9a-f]{40}$/.test(hash)
    ? hash.slice(0, 7) + (suffix ? `-${suffix}` : '')
    : commit
}
