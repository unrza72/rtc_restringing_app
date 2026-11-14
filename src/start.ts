import {
  createMiddleware,
  createStart,
  createCsrfMiddleware,
} from '@tanstack/react-start'

import {
  SECURITY_HEADERS,
  contentSecurityPolicy,
  createNonce,
} from '#/lib/security-headers'

/**
 * Paraglide resolves the locale from the URL prefix ("/de/..."). On the server
 * that has to be established per request, otherwise `getLocale()` falls back to
 * the base locale and the router's `output` rewrite drops the prefix — which
 * turns every German URL into a redirect to its English twin.
 *
 * Server function calls are the exception: they hit a fixed RPC endpoint
 * (`/_serverFn/...`) that carries no locale prefix of its own, so the URL
 * strategy has nothing to read there — every `m.*()` call made inside a
 * server function's handler (a business-rule error, say) would otherwise
 * always render in the base locale, regardless of the page that called it.
 * The Referer is that calling page's URL and does carry the prefix — a
 * same-origin `fetch()` always sends one — so RPC calls resolve locale from
 * that instead. This only steers locale detection; the request `next()`
 * actually dispatches is the untouched original either way (see below).
 *
 * The router itself does the URL rewriting (see `src/router.tsx`), so the
 * original request is passed straight through here; this middleware only sets
 * up the locale context.
 */
const localeMiddleware = createMiddleware().server(
  async ({ next, request, handlerType }) => {
    const { paraglideMiddleware } = await import('#/paraglide/server')
    const effectiveRequestUrl =
      handlerType === 'serverFn'
        ? (request.headers.get('referer') ?? request.url)
        : request.url
    return paraglideMiddleware(request, () => next(), { effectiveRequestUrl })
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

// Outermost, so even a request the CSRF check turns away gets the headers.
// The nonce travels on in the request context: `getRouter()` (src/router.tsx)
// hands it to the router, which stamps it on every inline script it renders.
//
// The CSP is left out in development, where Vite injects inline scripts of its
// own (the React refresh preamble) that no nonce covers. The UI tests run the
// production build, so they do see it.
const securityHeaders = createMiddleware().server(async ({ next }) => {
  const cspNonce = createNonce()
  const result = await next({ context: { cspNonce } })

  const headers = new Headers(SECURITY_HEADERS)
  if (process.env.NODE_ENV === 'production') {
    headers.set(
      'Content-Security-Policy',
      contentSecurityPolicy(cspNonce, {
        https: process.env.BETTER_AUTH_URL?.startsWith('https://') ?? false,
      }),
    )
  }
  try {
    for (const [name, value] of headers)
      result.response.headers.set(name, value)
  } catch {
    // `Response.redirect()` freezes its headers. A bare redirect has no body
    // to protect, so it goes out as it is.
  }
  return result
})

export const startInstance = createStart(() => ({
  requestMiddleware: [securityHeaders, csrf, localeMiddleware],
}))
