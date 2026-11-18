/**
 * The facts the imprint (/imprint) and the privacy notice (/privacy) are
 * built from. The site is public, so Austrian law requires both: § 5 ECG and
 * § 25 MedienG for the imprint, Art. 13 GDPR for the privacy notice.
 *
 * `null` means "not known yet": the page then shows a visible "missing"
 * marker in its place rather than leaving the gap unnoticed. Fill these in
 * from the club's statutes and the Vereinsregister extract
 * (https://citizen.bmi.gv.at/at.gv.bmi.fnsweb-p/zvn/public/Registerauszug).
 */
export const LEGAL = {
  clubName: 'Royal Tennisclub Bezau',

  /** Street and house number of the club's registered address. */
  street: 'Staudenhof 515',
  postalCode: '6870',
  town: 'Bezau',
  country: { de: 'Österreich', en: 'Austria' },

  /** ZVR-Zahl from the Vereinsregister, nine digits. */
  zvr: '111367004',

  /** The authority the club is registered with. */
  registrationAuthority: 'Bezirkshauptmannschaft Bregenz',

  /** Who represents the club, e.g. "Max Muster (Obmann)". */
  representedBy: 'Martin Fink',

  /** Contact address for the imprint, and for data protection requests. */
  email: 'tennis@rtc-bezau.at',
  /** Optional; leave null to show no phone number. */
  phone: null as string | null,

  /** The club's purpose as in its statutes (§ 25 MedienG). */
  purpose: {
    de: null as string | null,
    en: null as string | null,
  },

  /**
   * Who runs the server the app is on, e.g. "Hetzner Online GmbH,
   * Industriestr. 25, 91710 Gunzenhausen, Deutschland". A host outside the
   * EU/EEA needs a sentence on the transfer safeguards in the privacy notice.
   */
  hosting: 'AWS Europe (eu-central-1)',

  /**
   * How long the reverse proxy (nginx, Caddy) keeps access logs with IP
   * addresses, in days. 0 if it keeps none. The app itself writes no
   * access log.
   */
  accessLogDays: 30,

  /** Shown as "last updated" on the privacy notice. Bump it on every change. */
  privacyUpdated: '2026-11-18',
} as const
