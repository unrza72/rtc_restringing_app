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
import { SiteFooter } from '#/components/site-footer'

import appCss from '../styles.css?url'
import badgeUrl from '../../misc/rtc-racket-badge.svg?url'

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
      // Fonts are bundled into this stylesheet (src/styles.css), not loaded
      // from Google, so a visit sends nothing to a third party.
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
      <body className="flex min-h-screen flex-col bg-background text-foreground antialiased">
        <AppNav />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 md:py-10">
          <Breadcrumbs />
          {children}
        </main>
        <SiteFooter />
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
