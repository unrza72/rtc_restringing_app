// First, before any module that builds a Zod schema (see the file).
import './lib/zod-config'
import { createRouter as createTanStackRouter } from '@tanstack/react-router'
import { getGlobalStartContext } from '@tanstack/react-start'

import { deLocalizeUrl, localizeUrl } from './paraglide/runtime'
import { routeTree } from './routeTree.gen'

export function getRouter() {
  const router = createTanStackRouter({
    routeTree,
    // The per-request CSP nonce from src/start.ts, put on every inline script
    // the router renders. Undefined in the browser, which needs none.
    ssr: { nonce: getGlobalStartContext()?.cspNonce },
    scrollRestoration: true,
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
    // Paraglide's url strategy prefixes non-default locales ("/de/rackets").
    // The route tree only knows the plain paths, so strip the prefix on the way
    // in and put it back on the way out — otherwise every German URL 404s.
    rewrite: {
      input: ({ url }) => deLocalizeUrl(url),
      output: ({ url }) => localizeUrl(url),
    },
  })

  return router
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
