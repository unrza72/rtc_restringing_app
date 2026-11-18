import { Link } from '@tanstack/react-router'

import { m } from '#/paraglide/messages'

/** On every page, signed in or not: imprint and privacy notice. */
export function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <nav
        aria-label={m.footer_label()}
        className="mx-auto flex w-full max-w-6xl flex-wrap gap-x-6 gap-y-2 px-4 py-4 text-sm text-muted-foreground sm:px-6"
      >
        <Link to="/imprint" className="hover:text-foreground hover:underline">
          {m.footer_imprint()}
        </Link>
        <Link to="/privacy" className="hover:text-foreground hover:underline">
          {m.footer_privacy()}
        </Link>
      </nav>
    </footer>
  )
}
