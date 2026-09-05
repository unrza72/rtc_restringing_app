import { Link, useRouteContext, useRouter } from '@tanstack/react-router'
import { LogOut, Menu } from 'lucide-react'
import { useState } from 'react'

import { authClient } from '#/lib/auth-client'
import { m } from '#/paraglide/messages'
import { getLocale, locales, setLocale } from '#/paraglide/runtime'
import { Button } from '#/components/ui/button'
import { cn } from '#/lib/utils'

type NavItem = { to: string; label: string }

export function AppNav() {
  const { user } = useRouteContext({ from: '__root__' })
  const router = useRouter()
  const [open, setOpen] = useState(false)

  const approved = user?.status === 'APPROVED'
  const items: Array<NavItem> = approved
    ? [
        { to: '/dashboard', label: m.nav_dashboard() },
        { to: '/rackets', label: m.nav_rackets() },
        { to: '/requests', label: m.nav_requests() },
        ...(user.roles.includes('operator')
          ? [{ to: '/queue', label: m.nav_queue() }]
          : []),
        ...(user.roles.includes('admin')
          ? [
              { to: '/admin/members', label: m.nav_admin_members() },
              { to: '/admin/strings', label: m.nav_admin_strings() },
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
    <header className="border-b bg-card">
      <div className="mx-auto flex w-full max-w-5xl items-center gap-4 px-4 py-3">
        <Link
          to={approved ? '/dashboard' : '/'}
          className="font-semibold tracking-tight whitespace-nowrap"
        >
          {m.app_name()}
        </Link>

        <nav className="hidden flex-1 items-center gap-1 md:flex">
          {items.map((item) => (
            <NavLink key={item.to} {...item} />
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2 md:ml-0">
          <LocaleToggle />
          {user ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSignOut}
              aria-label={m.nav_sign_out()}
            >
              <LogOut className="size-4" />
              <span className="hidden sm:inline">{m.nav_sign_out()}</span>
            </Button>
          ) : (
            <Button asChild size="sm" variant="ghost">
              <Link to="/login" search={{ redirect: undefined }}>
                {m.nav_sign_in()}
              </Link>
            </Button>
          )}
          {items.length > 0 && (
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              aria-label={m.nav_menu()}
              aria-expanded={open}
              onClick={() => setOpen((v) => !v)}
            >
              <Menu className="size-4" />
            </Button>
          )}
        </div>
      </div>

      {open && items.length > 0 && (
        <nav className="flex flex-col gap-1 border-t px-4 py-2 md:hidden">
          {items.map((item) => (
            <NavLink
              key={item.to}
              {...item}
              onNavigate={() => setOpen(false)}
            />
          ))}
        </nav>
      )}
    </header>
  )
}

function NavLink({
  to,
  label,
  onNavigate,
}: NavItem & { onNavigate?: () => void }) {
  return (
    <Link
      to={to}
      onClick={onNavigate}
      className={cn(
        'rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors',
        'hover:bg-accent hover:text-accent-foreground',
      )}
      activeProps={{
        className: 'bg-accent text-accent-foreground font-medium',
      }}
    >
      {label}
    </Link>
  )
}

function LocaleToggle() {
  const current = getLocale()
  return (
    <div
      className="flex items-center rounded-md border p-0.5"
      aria-label={m.language_label()}
    >
      {locales.map((locale) => (
        <button
          key={locale}
          type="button"
          onClick={() => setLocale(locale)}
          aria-pressed={locale === current}
          className={cn(
            'rounded px-2 py-0.5 text-xs font-medium transition-colors',
            locale === current
              ? 'bg-foreground text-background'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {locale.toUpperCase()}
        </button>
      ))}
    </div>
  )
}
