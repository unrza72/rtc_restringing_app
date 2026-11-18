import { execSync } from 'node:child_process'
import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'
import { paraglideVitePlugin } from '@inlang/paraglide-js'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { nitro } from 'nitro/vite'

/**
 * The commit this build was made from, shown to admins on /admin/strings.
 * deploy.sh builds right after `git pull`, so this is what runs in production.
 * BUILD_COMMIT overrides it for builds outside a git checkout; "-dirty" marks
 * a build with uncommitted changes.
 */
function buildCommit() {
  if (process.env.BUILD_COMMIT) return process.env.BUILD_COMMIT
  try {
    const hash = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim()
    const dirty = execSync('git status --porcelain --untracked-files=no', {
      encoding: 'utf8',
    }).trim()
    return dirty ? `${hash}-dirty` : hash
  } catch {
    return 'unknown'
  }
}

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  define: {
    'import.meta.env.VITE_BUILD_COMMIT': JSON.stringify(buildCommit()),
    'import.meta.env.VITE_BUILD_TIME': JSON.stringify(new Date().toISOString()),
  },
  plugins: [
    devtools(),
    paraglideVitePlugin({
      project: './project.inlang',
      outdir: './src/paraglide',
      strategy: ['url', 'baseLocale'],
    }),
    nitro({ rollupConfig: { external: [/^@sentry\//] } }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
})

export default config
