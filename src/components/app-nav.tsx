import { Link, useRouteContext, useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import {
  Clock,
  GraduationCap,
  HandCoins,
  Languages,
  Layers,
  LogOut,
  Menu,
  Plus,
  Receipt,
  Spool,
  UserPlus,
  Users,
  Wrench,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useState } from 'react'

import { authClient } from '#/lib/auth-client'
import { setMyLocale } from '#/server/locale.functions'
import { m } from '#/paraglide/messages'
import { getLocale, locales, setLocale } from '#/paraglide/runtime'
import { cn } from '#/lib/utils'

/**
 * Sticky header: mark on the left, tabs in the middle, actions on the right.
 *
 * Kept deliberately quiet. The tabs share one neutral active state rather than
 * a colour per role — colour earns its place on the status badges and the one
 * call to action, and spending it here as well made the bar read as noise.
 */

type NavItem = {
  to: string
  label: string
  icon: LucideIcon
  // /billing has its own child route (/billing/payouts) with its own tab, so
  // it must not also light up while that child route is active.
  exact?: boolean
}

export function AppNav() {
  const { user } = useRouteContext({ from: '__root__' })
  const router = useRouter()
  const [open, setOpen] = useState(false)

  const approved = user?.status === 'APPROVED'
  const items: Array<NavItem> = approved
    ? [
        { to: '/rackets', label: m.nav_rackets(), icon: Layers },
        { to: '/requests', label: m.nav_requests(), icon: Clock },
        ...(user.roles.includes('operator')
          ? [{ to: '/queue', label: m.nav_queue(), icon: Wrench }]
          : []),
        ...(user.roles.includes('operator') || user.roles.includes('controller')
          ? [
              {
                to: '/billing',
                label: m.nav_billing(),
                icon: Receipt,
                exact: true,
              },
            ]
          : []),
        ...(user.roles.includes('controller')
          ? [
              {
                to: '/billing/payouts',
                label: m.nav_payouts(),
                icon: HandCoins,
              },
            ]
          : []),
        ...(user.roles.includes('operator')
          ? [{ to: '/invites', label: m.nav_invites(), icon: UserPlus }]
          : []),
        ...(user.roles.includes('coach')
          ? [
              {
                to: '/training',
                label: m.nav_training(),
                icon: GraduationCap,
              },
            ]
          : []),
        ...(user.roles.includes('admin')
          ? [
              {
                to: '/admin/members',
                label: m.nav_admin_members(),
                icon: Users,
              },
              {
                to: '/admin/strings',
                label: m.nav_admin_strings(),
                icon: Spool,
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
    <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <div className="flex h-14 items-center gap-3">
          <Link
            to={approved ? '/dashboard' : '/'}
            className="flex shrink-0 items-center gap-2.5 select-none"
          >
            <span className="ball-tile flex size-8 items-center justify-center rounded-lg text-base">
              🎾
            </span>
            <span className="text-base font-bold tracking-tight text-white">
              {m.app_name()}
            </span>
          </Link>

          {items.length > 0 && (
            <nav className="ml-4 hidden items-center gap-0.5 lg:flex">
              {items.map((item) => (
                <NavTab key={item.to} {...item} />
              ))}
            </nav>
          )}

          <div className="ml-auto flex items-center gap-1.5">
            {approved && (
              <Link
                to="/requests/new"
                title={m.dash_new_request()}
                className={cn(
                  'flex items-center gap-1.5 rounded-lg bg-lime-400 px-3 py-1.5',
                  'text-xs font-bold text-slate-950 transition-colors hover:bg-lime-300',
                )}
              >
                <Plus className="size-3.5 stroke-[3]" />
                <span className="hidden sm:inline">{m.dash_new_request()}</span>
              </Link>
            )}

            <LocaleToggle signedIn={!!user} />

            {user ? (
              <>
                <span className="hidden items-center gap-2 pr-1 pl-2 md:flex">
                  <span className="flex size-7 items-center justify-center rounded-full bg-slate-800 text-[11px] font-bold text-slate-300">
                    {user.name.charAt(0).toUpperCase()}
                  </span>
                  <span className="text-xs font-medium text-slate-300">
                    {user.name}
                  </span>
                </span>
                <IconButton
                  label={m.nav_sign_out()}
                  icon={LogOut}
                  onClick={handleSignOut}
                />
              </>
            ) : (
              <Link
                to="/login"
                search={{ redirect: undefined }}
                className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-300 transition-colors hover:bg-slate-900 hover:text-white"
              >
                {m.nav_sign_in()}
              </Link>
            )}

            {items.length > 0 && (
              <span className="lg:hidden">
                <IconButton
                  label={m.nav_menu()}
                  icon={Menu}
                  expanded={open}
                  onClick={() => setOpen((v) => !v)}
                />
              </span>
            )}
          </div>
        </div>

        {open && items.length > 0 && (
          <nav className="flex flex-col gap-0.5 border-t border-slate-800/80 py-2 lg:hidden">
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
  exact,
  onNavigate,
}: NavItem & { onNavigate?: () => void }) {
  return (
    <Link
      to={to}
      onClick={onNavigate}
      activeOptions={{ exact }}
      className={cn(
        'flex items-center gap-2 rounded-lg px-3 py-1.5',
        'text-xs font-medium text-slate-400 transition-colors',
        'hover:bg-slate-900 hover:text-slate-100',
      )}
      activeProps={{ className: 'bg-slate-800 text-white font-semibold' }}
    >
      <Icon className="size-3.5" />
      {label}
    </Link>
  )
}

function IconButton({
  label,
  icon: Icon,
  expanded,
  onClick,
}: {
  label: string
  icon: LucideIcon
  expanded?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-expanded={expanded}
      className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-900 hover:text-slate-100"
    >
      <Icon className="size-4" />
    </button>
  )
}

function LocaleToggle({ signedIn }: { signedIn: boolean }) {
  const current = getLocale()
  const next = locales.find((l) => l !== current) ?? current
  const setMyLocaleFn = useServerFn(setMyLocale)

  async function handleClick() {
    // Persisted first, awaited: setLocale() below reloads the page, and that
    // reload's own request is what root's beforeLoad uses to decide whether
    // to redirect for a saved preference — the write has to land first, or a
    // slow save could lose the race and the reload would look like it undid
    // the switch.
    if (signedIn) {
      try {
        await setMyLocaleFn({ data: { locale: next } })
      } catch {
        // Not fatal — the locale still switches for this browser via the
        // cookie/URL below, it just won't follow to another device this time.
      }
    }
    setLocale(next)
  }

  // Two locales only, so a single toggle showing the other one beats a
  // segmented control that always has half its pixels switched off.
  return (
    <button
      type="button"
      onClick={() => void handleClick()}
      title={m.language_switch_to({ locale: next.toUpperCase() })}
      aria-label={m.language_switch_to({ locale: next.toUpperCase() })}
      className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-bold tracking-wider text-slate-400 transition-colors hover:bg-slate-900 hover:text-slate-100"
    >
      <Languages className="size-3.5" />
      {next.toUpperCase()}
    </button>
  )
}
