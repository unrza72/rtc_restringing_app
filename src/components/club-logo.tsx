import badgeUrl from '../../misc/rtc-racket-badge.svg?url'

import { m } from '#/paraglide/messages'
import { cn } from '#/lib/utils'

/**
 * The club mark as misc/BRAND.md lays it out for the web header: the badge,
 * then the club name in Playfair Display, terracotta, uppercase. The badge
 * is the "Restringing" service mark (wreath + strung racket) — swap the import
 * above for the full crest once there is an SVG of it.
 *
 * `stacked` centres everything under the badge, for the sign-in screens.
 */
export function ClubLogo({
  stacked = false,
  className,
}: {
  stacked?: boolean
  className?: string
}) {
  return (
    <span
      className={cn(
        'flex items-center select-none',
        stacked ? 'flex-col gap-4 text-center' : 'gap-3',
        className,
      )}
    >
      <img
        src={badgeUrl}
        alt=""
        width={200}
        height={210}
        className={cn('w-auto shrink-0', stacked ? 'h-24' : 'h-10')}
      />
      <span
        className={cn(
          'flex flex-col',
          stacked ? 'items-center' : 'hidden sm:flex',
        )}
      >
        <span
          className={cn(
            'font-display leading-none font-semibold tracking-[0.08em] text-brand uppercase',
            stacked ? 'text-3xl' : 'text-xl',
          )}
        >
          {m.club_name()}
        </span>
        <span className="mt-1 text-[11px] font-medium tracking-[0.16em] text-muted-foreground uppercase">
          {m.club_service_label()}
        </span>
      </span>
    </span>
  )
}
