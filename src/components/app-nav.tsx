import { Link, useRouteContext, useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import {
  CircleHelp,
  Clock,
  GraduationCap,
  HandCoins,
  Languages,
  Layers,
  LifeBuoy,
  LogOut,
  Menu,
  Plus,
  Receipt,
  Spool,
  UserPlus,
  Users,
  Wrench,
  X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useEffect, useState } from 'react'

import { authClient } from '#/lib/auth-client'
import { setMyLocale } from '#/server/locale.functions'
import { m } from '#/paraglide/messages'
import { getLocale, locales, setLocale } from '#/paraglide/runtime'
import { cn } from '#/lib/utils'
import { ClubLogo } from '#/components/club-logo'
import { openOnboardingTour } from '#/components/onboarding-tour'

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
        { to: '/help', label: m.nav_help(), icon: LifeBuoy },
      ]
    : []

  async function handleSignOut() {
    await authClient.signOut()
    await router.invalidate()
    await router.navigate({ to: '/login', search: { redirect: undefined } })
  }

  // Escape closes the mobile menu, like any other overlay.
  useEffect(() => {
    if (!open) return
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-md">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
          <div className="flex h-16 items-center gap-3">
            <Link
              to={approved ? '/dashboard' : '/'}
              aria-label={m.club_name()}
              className="shrink-0"
            >
              <ClubLogo />
            </Link>

            <div className="ml-auto flex items-center gap-1.5">
              {approved && (
                <Link
                  to="/requests/new"
                  title={m.dash_new_request()}
                  className={cn(
                    'flex min-h-9 items-center gap-1.5 rounded-full bg-primary px-4',
                    'text-xs font-medium text-primary-foreground transition-colors hover:bg-primary-hover',
                  )}
                >
                  <Plus className="size-3.5 stroke-[3]" />
                  <span className="hidden sm:inline">
                    {m.dash_new_request()}
                  </span>
                </Link>
              )}

              <LocaleToggle signedIn={!!user} />

              {user ? (
                <>
                  <span className="hidden items-center gap-2 pr-1 pl-2 md:flex">
                    <span className="flex size-7 items-center justify-center rounded-full bg-muted text-[11px] font-bold text-foreground">
                      {user.name.charAt(0).toUpperCase()}
                    </span>
                    <span className="text-xs font-medium text-foreground">
                      {user.name}
                    </span>
                  </span>
                  {approved && (
                    // On small screens the same entry lives in the menu below.
                    <span className="hidden lg:inline-flex">
                      <IconButton
                        label={m.onboarding_replay()}
                        icon={CircleHelp}
                        onClick={openOnboardingTour}
                      />
                    </span>
                  )}
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
                  className="rounded-lg px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-sand hover:text-foreground"
                >
                  {m.nav_sign_in()}
                </Link>
              )}

              {items.length > 0 && (
                <span className="lg:hidden">
                  <IconButton
                    label={m.nav_menu()}
                    icon={open ? X : Menu}
                    expanded={open}
                    onClick={() => setOpen((v) => !v)}
                  />
                </span>
              )}
            </div>
          </div>

          {/* Tabs get a row of their own: a staff account carries up to nine,
            which never fit beside the club wordmark in a 6xl container. */}
          {items.length > 0 && (
            <nav className="-mx-3 hidden items-center gap-0.5 overflow-x-auto pb-2 lg:flex">
              {items.map((item) => (
                <NavTab key={item.to} {...item} />
              ))}
            </nav>
          )}

          {open && items.length > 0 && (
            <nav className="-mx-4 flex flex-col gap-1 border-t-2 border-primary bg-sand px-4 py-3 sm:-mx-6 sm:px-6 lg:hidden">
              {items.map((item) => (
                <NavTab
                  key={item.to}
                  {...item}
                  inMenu
                  onNavigate={() => setOpen(false)}
                />
              ))}
              <button
                type="button"
                onClick={() => {
                  setOpen(false)
                  openOnboardingTour()
                }}
                className={cn(MENU_ITEM, MENU_ITEM_IDLE, 'text-left')}
              >
                <CircleHelp className="size-4" />
                {m.onboarding_replay()}
              </button>
            </nav>
          )}
        </div>
      </header>

      {/* Below the header (z-40), over the page: blurs what the open menu
        covers, and a tap anywhere on it closes the menu. Outside <header>
        because the header's own backdrop-blur would clip a fixed child. */}
      {open && items.length > 0 && (
        <div
          aria-hidden
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-30 bg-court-900/20 backdrop-blur-sm lg:hidden"
        />
      )}
    </>
  )
}

/** A row in the mobile menu: 0.5rem taller than a desktop tab, larger text. */
const MENU_ITEM =
  'flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors'
const MENU_ITEM_IDLE =
  'text-muted-foreground hover:bg-background hover:text-foreground'

function NavTab({
  to,
  label,
  icon: Icon,
  exact,
  inMenu = false,
  onNavigate,
}: NavItem & { inMenu?: boolean; onNavigate?: () => void }) {
  return (
    <Link
      to={to}
      onClick={onNavigate}
      activeOptions={{ exact }}
      className={
        inMenu
          ? MENU_ITEM
          : cn(
              'flex items-center gap-2 rounded-lg px-3 py-1.5 whitespace-nowrap',
              'text-xs font-medium text-muted-foreground transition-colors',
              'hover:bg-sand hover:text-foreground',
            )
      }
      inactiveProps={{ className: inMenu ? MENU_ITEM_IDLE : undefined }}
      activeProps={{
        className: inMenu
          ? 'bg-primary text-primary-foreground font-semibold hover:bg-primary-hover'
          : 'bg-sand text-foreground font-semibold',
      }}
    >
      <Icon className={inMenu ? 'size-4' : 'size-3.5'} />
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
      className={cn(
        'rounded-lg p-2 transition-colors',
        expanded
          ? 'bg-primary text-primary-foreground hover:bg-primary-hover'
          : 'text-muted-foreground hover:bg-sand hover:text-foreground',
      )}
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
      className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-bold tracking-wider text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      <Languages className="size-3.5" />
      {next.toUpperCase()}
    </button>
  )
}
