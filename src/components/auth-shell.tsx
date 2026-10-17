import type { ReactNode } from 'react'

import { m } from '#/paraglide/messages'
import { ClubLogo } from '#/components/club-logo'

/**
 * The prototype's full-page gate: ball tile, wordmark, then a single dark card.
 * There is nothing meaningful to show before login, so this deliberately fills
 * the viewport rather than sitting inside the app chrome.
 */
export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: ReactNode
}) {
  return (
    <div className="mx-auto w-full max-w-md py-6">
      <div className="mb-6 text-center">
        <ClubLogo stacked className="mx-auto" />
        <h1 className="mt-6 text-2xl text-foreground">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {subtitle ?? m.app_tagline()}
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        {children}
      </div>
    </div>
  )
}
