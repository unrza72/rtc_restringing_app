import { createFileRoute } from '@tanstack/react-router'

import { m } from '#/paraglide/messages'
import { PrivacyNotice } from '#/components/legal'

/** Public, signed in or not, so it can be read before signing up. */
export const Route = createFileRoute('/privacy')({
  head: () => ({ meta: [{ title: m.legal_privacy_title() }] }),
  component: PrivacyNotice,
})
