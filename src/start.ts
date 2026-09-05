import { createMiddleware, createStart } from '@tanstack/react-start'

/**
 * Paraglide resolves the locale from the URL prefix ("/de/..."). On the server
 * that has to be established per request, otherwise `getLocale()` falls back to
 * the base locale and the router's `output` rewrite drops the prefix — which
 * turns every German URL into a redirect to its English twin.
 *
 * The router itself does the URL rewriting (see `src/router.tsx`), so the
 * original request is passed straight through here; this middleware only sets
 * up the locale context.
 */
const localeMiddleware = createMiddleware().server(
  async ({ next, request }) => {
    const { paraglideMiddleware } = await import('#/paraglide/server')
    return paraglideMiddleware(request, () => next())
  },
)

export const startInstance = createStart(() => ({
  requestMiddleware: [localeMiddleware],
}))
