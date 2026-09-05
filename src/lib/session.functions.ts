import { createServerFn } from '@tanstack/react-start'

/**
 * Read by the root route on every navigation so guards and the nav bar always
 * see fresh state — an admin approving a member takes effect on their next
 * navigation, with no reload.
 */
export const fetchSession = createServerFn({ method: 'GET' }).handler(
  async () => {
    const { getSessionUser } = await import('./auth.server')
    return getSessionUser()
  },
)
