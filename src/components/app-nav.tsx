import { Link, useRouteContext, useRouter } from '@tanstack/react-router'
import {
  Layers,
  LogOut,
  Menu,
  Plus,
  Settings,
  Clock,
  Wrench,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useState } from 'react'

import { authClient } from '#/lib/auth-client'
import { m } from '#/paraglide/messages'
import { getLocale, locales, setLocale } from '#/paraglide/runtime'
import { cn } from '#/lib/utils'

/**
 * Sticky workshop header from the prototype: the tennis-ball tile on the left,
 * a pill rail of tabs in the middle, the lime call-to-action and the member
 * chip on the right. Tabs are tinted by side of the house — emerald for the
 * member's own things, amber for the stringer's bench, slate for admin.
 */

type NavItem = { to: string; label: string; icon: LucideIcon; accent: string }

export function AppNav() {
  const { user } = useRouteContext({ from: '__root__' })
  const router = useRouter()
  const [open, setOpen] = useState(false)

  const approved = user?.status === 'APPROVED'
  const items: Array<NavItem> = approved
    ? [
        {
          to: '/rackets',
          label: m.nav_rackets(),
          icon: Layers,
          accent: 'bg-emerald-600',
        },
        {
          to: '/requests',
          label: m.nav_requests(),
          icon: Clock,
          accent: 'bg-emerald-600',
        },
        ...(user.roles.includes('operator')
          ? [
              {
                to: '/queue',
                label: m.nav_queue(),
                icon: Wrench,
                accent: 'bg-amber-600',
              },
            ]
          : []),
        ...(user.roles.includes('admin')
          ? [
              {
                to: '/admin/members',
                label: m.nav_admin_members(),
                icon: Settings,
                accent: 'bg-slate-600',
              },
              {
                to: '/admin/strings',
                label: m.nav_admin_strings(),
                icon: Settings,
                accent: 'bg-slate-600',
              },
            ]
          : []),
      ]
    : []

  async function handleSignOut() {
    await authClient.signOut()
    await router.invalidate()
    await router.navigate({ to: '/login', search: { redirect: undefined } })
  }

  return (
    <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-950/90 backdrop-blur-md">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <div className="flex h-16 items-center justify-between gap-4">
          <Link
            to={approved ? '/dashboard' : '/'}
            className="flex select-none items-center gap-3"
          >
            <span className="ball-tile flex size-10 items-center justify-center rounded-xl text-xl">
              🎾
            </span>
            <span className="hidden sm:block">
              <span className="flex items-center gap-1.5">
                <span className="text-lg font-extrabold tracking-tight text-white">
                  {m.app_name()}
                </span>
                <span className="rounded border border-lime-400/30 bg-lime-400/20 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-lime-300 uppercase">
                  {m.app_badge()}
                </span>
              </span>
              <span className="block text-[11px] leading-none text-slate-400">
                {m.app_tagline()}
              </span>
            </span>
          </Link>

          {items.length > 0 && (
            <nav className="hidden items-center gap-1 rounded-xl border border-slate-800 bg-slate-900/80 p-1 lg:flex">
              {items.map((item) => (
                <NavTab key={item.to} {...item} />
              ))}
            </nav>
          )}

          <div className="flex items-center gap-2.5">
            {approved && (
              <Link
                to="/requests/new"
                className={cn(
                  'hidden items-center gap-1.5 rounded-xl px-3.5 py-2 sm:flex',
                  'bg-lime-400 text-xs font-bold text-slate-950 shadow-md shadow-lime-400/10',
                  'transition-all hover:bg-lime-300 active:scale-95',
                )}
              >
                <Plus className="size-3.5 stroke-[3]" />
                {m.dash_new_request()}
              </Link>
            )}

            <LocaleToggle />

            {user ? (
              <>
                <span className="hidden items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 py-1.5 pr-3 pl-2 md:flex">
                  <span className="flex size-7 items-center justify-center rounded-lg bg-slate-800 text-xs font-bold text-lime-300">
                    {user.name.charAt(0).toUpperCase()}
                  </span>
                  <span>
                    <span className="block text-xs leading-tight font-bold text-white">
                      {user.name}
                    </span>
                    <span className="block text-[10px] leading-tight text-slate-400">
                      {user.roles.includes('admin')
                        ? `🔧 ${m.role_admin()}`
                        : user.roles.includes('operator')
                          ? `🔧 ${m.role_operator()}`
                          : `🎾 ${m.role_member()}`}
                    </span>
                  </span>
                </span>
                <button
                  type="button"
                  onClick={handleSignOut}
                  title={m.nav_sign_out()}
                  aria-label={m.nav_sign_out()}
                  className="rounded-xl border border-transparent p-2 text-slate-400 transition hover:border-slate-800 hover:bg-slate-900 hover:text-slate-200"
                >
                  <LogOut className="size-4" />
                </button>
              </>
            ) : (
              <Link
                to="/login"
                search={{ redirect: undefined }}
                className="rounded-xl px-3.5 py-2 text-xs font-bold text-slate-300 transition hover:bg-slate-900 hover:text-white"
              >
                {m.nav_sign_in()}
              </Link>
            )}

            {items.length > 0 && (
              <button
                type="button"
                className="rounded-xl border border-transparent p-2 text-slate-400 transition hover:border-slate-800 hover:bg-slate-900 hover:text-slate-200 lg:hidden"
                aria-label={m.nav_menu()}
                aria-expanded={open}
                onClick={() => setOpen((v) => !v)}
              >
                <Menu className="size-4" />
              </button>
            )}
          </div>
        </div>

        {open && items.length > 0 && (
          <nav className="flex flex-col gap-1 border-t border-slate-800 py-2 lg:hidden">
            {items.map((item) => (
              <NavTab
                key={item.to}
                {...item}
                onNavigate={() => setOpen(false)}
              />
            ))}
          </nav>
        )}
      </div>
    </header>
  )
}

function NavTab({
  to,
  label,
  icon: Icon,
  accent,
  onNavigate,
}: NavItem & { onNavigate?: () => void }) {
  return (
    <Link
      to={to}
      onClick={onNavigate}
      className={cn(
        'flex items-center gap-2 rounded-lg px-3.5 py-2',
        'text-xs font-semibold text-slate-300 transition-all',
        'hover:bg-slate-800 hover:text-white',
      )}
      activeProps={{ className: cn(accent, 'text-white shadow-md') }}
    >
      <Icon className="size-3.5" />
      {label}
    </Link>
  )
}

function LocaleToggle() {
  const current = getLocale()
  return (
    <span
      className="flex items-center rounded-xl border border-slate-800 bg-slate-900 p-0.5"
      aria-label={m.language_label()}
    >
      {locales.map((locale) => (
        <button
          key={locale}
          type="button"
          onClick={() => setLocale(locale)}
          aria-pressed={locale === current}
          className={cn(
            'rounded-lg px-2 py-1 text-[10px] font-bold tracking-wider transition-colors',
            locale === current
              ? 'bg-lime-400 text-slate-950'
              : 'text-slate-400 hover:text-slate-200',
          )}
        >
          {locale.toUpperCase()}
        </button>
      ))}
    </span>
  )
}
