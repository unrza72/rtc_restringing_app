import { createFileRoute } from '@tanstack/react-router'

import { m } from '#/paraglide/messages'
import { Imprint } from '#/components/legal'

/** Public, signed in or not: the law wants it one click from every page. */
export const Route = createFileRoute('/imprint')({
  head: () => ({ meta: [{ title: m.legal_imprint_title() }] }),
  component: Imprint,
})
