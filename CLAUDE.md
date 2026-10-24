@AGENTS.md

## UI: no overflow on mobile

Every page must work at phone width (360px) without horizontal scrolling.
Members mostly use the app on their phones at the court.

- Rows of actions or labels wrap (`flex-wrap`), or move to their own line on a
  phone and back inline from `sm:` up. A row that can't wrap stretches the whole
  page, not just itself. No sideways-swiping strips for filters or buttons
  either: half a button at the screen edge reads as overflow. In tests, check
  such controls with `toBeInViewport({ ratio: 1 })`, since the page-overflow
  check lets content inside a scroller through.
- Flex and grid children that hold long text get `min-w-0`; long single words
  (German: "Abrechnungsübersicht") get `wrap-break-word hyphens-auto`.
- When labelled buttons don't fit, show icons on a phone and keep the label as
  `sr-only sm:not-sr-only` text plus a `title`, so screen readers and tests
  still find them by name.
- Lists that are tables on a desktop become one card per item on a phone
  (`md:hidden` list, `hidden md:block` table, as in the queue). A table that
  stays must scroll inside its own container, and its grid/flex parent needs
  `min-w-0`, or the table's width stretches the page anyway.
- Check new UI at phone width in its Playwright spec: `PHONE` and
  `expectNoHorizontalOverflow(page)` from `tests/ui/support.ts` fail with the
  elements that stick out.

## Editing route files

While `pnpm dev` runs, the TanStack route generator replaces an empty file in
`src/routes/` with a "Hello" stub. Never truncate-then-write a route file
(shell redirects, `prettier --write` on a busy file): edit in place, or write
a temp file and `mv` it over.
