/**
 * Security headers for every response the app server sends.
 *
 * The Content-Security-Policy only allows scripts the app ships itself, plus
 * the inline scripts TanStack Start writes into each page (hydration data),
 * which carry a fresh per-request nonce — so an injected `<script>` or
 * `onclick=` never runs. Styles do allow inline: React renders `style={…}` as
 * attributes, and toasts inject a `<style>` element, neither with a nonce.
 */

export function contentSecurityPolicy(
  nonce: string,
  { https }: { https: boolean },
) {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'`,
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self'",
    "img-src 'self' data:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    // Same as X-Frame-Options: DENY, for browsers that read only one of them.
    "frame-ancestors 'none'",
    ...(https ? ['upgrade-insecure-requests'] : []),
  ].join('; ')
}

export const SECURITY_HEADERS: Record<string, string> = {
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  // Other sites see only the origin, never member or request ids in a path.
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
  // A page this one opens can't reach back into it through `window.opener`.
  'Cross-Origin-Opener-Policy': 'same-origin',
}

/** 128 random bits, base64 — a fresh one for every page. */
export function createNonce() {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return btoa(String.fromCharCode(...bytes))
}
