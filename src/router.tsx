import { createRouter as createTanStackRouter } from '@tanstack/react-router'

import { deLocalizeUrl, localizeUrl } from './paraglide/runtime'
import { routeTree } from './routeTree.gen'

export function getRouter() {
  const router = createTanStackRouter({
    routeTree,
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
