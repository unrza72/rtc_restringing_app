import {
  createMiddleware,
  createStart,
  createCsrfMiddleware,
} from '@tanstack/react-start'

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

// Server functions are same-origin RPC endpoints, and every content mutation is
// one of them — so without this, any site could POST to them in a logged-in
// editor's browser and have it publish, delete or promote on their behalf. The
// role checks in content.ts do not help: the request carries the victim's real
// session, so it passes them.
//
// Start applies this middleware itself only when an app declares no start
// instance of its own. This app declares one for the headers below, which opted
// it out of that default and left the server functions unguarded.
//
// Scoped to serverFn like Start's own default. Router requests are ordinary
// document navigations, which a cross-site check would break, and the API routes
// (Better Auth, assets, c15t) are not server functions and keep their own rules.
const csrf = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === 'serverFn',
})

export const startInstance = createStart(() => ({
  requestMiddleware: [csrf, localeMiddleware],
}))
