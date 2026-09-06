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

import appCss from '../styles.css?url'

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
      { title: 'RTC Restringing' },
    ],
    links: [{ rel: 'stylesheet', href: appCss }],
  }),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang={getLocale()}>
      <head>
        <HeadContent />
      </head>
      <body className="min-h-screen bg-slate-950 text-slate-100 antialiased">
        <AppNav />
        <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 md:py-10">
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
