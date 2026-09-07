import type { ReactNode } from 'react'

import { m } from '#/paraglide/messages'

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
        <span className="ball-tile mx-auto flex size-14 items-center justify-center rounded-2xl text-3xl">
          🎾
        </span>
        <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-white">
          {title}
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          {subtitle ?? m.app_tagline()}
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl">
        {children}
      </div>
    </div>
  )
}
