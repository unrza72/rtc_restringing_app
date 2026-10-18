import {
  HeadContent,
  Scripts,
  createRootRoute,
  redirect,
} from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'

import { getLocale, localizeUrl } from '#/paraglide/runtime'
import { fetchSession } from '#/lib/session.functions'
import { AppNav } from '#/components/app-nav'
import { Breadcrumbs } from '#/components/breadcrumbs'

import appCss from '../styles.css?url'
import badgeUrl from '../../misc/rtc-racket-badge.svg?url'

// Playfair Display for headings and the wordmark, Inter for UI text.
const FONTS_URL =
  'https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&family=Playfair+Display:ital,wght@0,400..900;1,400..900&display=swap'

export const Route = createRootRoute({
  beforeLoad: async ({ location }) => {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('lang', getLocale())
    }
    // Refetched on every navigation so an approval or role change lands
    // without the member having to reload.
    const user = await fetchSession()

    // A signed-in member's saved language follows them across devices/browsers
    // — if the current URL isn't already showing it, redirect to the one that
    // is. `location.href` has no origin (router-relative), so a placeholder
    // base is enough for path-only locale rewriting.
    if (user?.locale && user.locale !== getLocale()) {
      const target = localizeUrl(new URL(location.href, 'http://localhost'), {
        locale: user.locale,
      })
      throw redirect({ href: target.pathname + target.search + target.hash })
    }

    return { user }
  },

  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Royal Tennisclub Bezau' },
    ],
    links: [
      { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
      {
        rel: 'preconnect',
        href: 'https://fonts.gstatic.com',
        crossOrigin: 'anonymous',
      },
      { rel: 'stylesheet', href: FONTS_URL },
      { rel: 'stylesheet', href: appCss },
      { rel: 'icon', type: 'image/svg+xml', href: badgeUrl },
    ],
  }),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang={getLocale()}>
      <head>
        <HeadContent />
      </head>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <AppNav />
        <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 md:py-10">
          <Breadcrumbs />
          {children}
        </main>
        <TanStackDevtools
          config={{ position: 'bottom-right' }}
          plugins={[
            {
              name: 'Tanstack Router',
              render: <TanStackRouterDevtoolsPanel />,
            },
          ]}
        />
        <Scripts />
      </body>
    </html>
  )
}
