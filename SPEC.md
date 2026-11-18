# RTC Restringing App — Spec (v1.1, built)

Racket restringing requests for a local tennis club. Members register rackets and
request a restring; operators (members who string) work the queue and mark jobs done.
New accounts are unusable until an admin approves them.

Since v1.0 the app has grown a billing/payout side (§2, §4), invite-gated signup (§9),
a training planner (§13), a light theme (§14) and developer tooling (§15). **What the
spec promises but the code does not yet do is collected in §12** — start there.

## 1. Stack (already scaffolded)

| Concern   | Choice                                                                                |
| --------- | ------------------------------------------------------------------------------------- |
| Framework | TanStack Start (file routes in `src/routes`, `createServerFn` for mutations/loads)    |
| DB        | Prisma 7 + PostgreSQL (`@prisma/adapter-pg`); SQLite until Nov 2026                   |
| Auth      | better-auth 1.7 — `admin` plugin, `prismaAdapter`; email + password                   |
| UI        | Tailwind 4 + shadcn/ui (new-york), lucide icons; club brand theme, see §14            |
| Forms     | TanStack Form + Zod schemas shared client/server                                      |
| i18n      | Paraglide (`de` base, `en`) — all user-facing strings via messages                    |
| Tests     | Playwright browser tests, an HTTP-level e2e script, two pure unit-check scripts — §11 |

## 2. Roles

Single `role` column on the better-auth user (admin plugin, comma-separated for
multi-role). Roles cascade — each one implies everything to its left:

- **member** — own rackets, own requests. Everyone gets this.
- **operator** ("stringer") — member + sees the full queue, claims and completes jobs.
- **controller** — member + views the billing overview, sets/resets a job's paid state,
  and reconciles the labour payout ledger. Independent of operator — a controller
  need not string rackets.
- **coach** — member + runs the training planner (§13): the trainee/trainer roster,
  their weekly availability, and the grouping solver. Independent of the other two.
- **admin** — implies operator, controller, coach and member. Approves members, assigns
  roles, edits the string catalogue, and can do anything the others can.

`operator`, `controller` and `coach` are parallel specialties, not a ladder — a club can
have someone who only reconciles payments and never touches a stringing machine.

## 3. Approval flow

There is no open signup. An operator or admin creates a single-use invite link
at `/invites` (expiry configurable at creation, default 24h); `/signup` refuses
to create an account without one.

1. Someone follows an invite link (`/signup?token=…`), signs up with name, email
   and password. Email is the login identifier.
2. User row is created with `status = PENDING`.
3. They are signed in but every app route guard bounces them to `/pending`
   ("waiting for approval") — they can only sign out.
4. Admin approves at `/admin/members` → `status = APPROVED`, full access.
   Rejecting sets `status = REJECTED` (kept for audit) and deletes the member's
   sessions, so they are signed out at once. **As built, a rejected member can still
   sign in again** — they are then confined to `/pending`, which shows "account not
   approved" instead of "waiting". v1.0 said "cannot sign in"; see §12.
5. On their first visit after approval, the member gets a **welcome tour** — a dialog
   hosted by the `_authed` layout, so it opens on whichever page they land on. It walks
   through requesting a restring, dropping the racket off (with the carabiner, when
   racket tokens are on) and the status a request moves through, then offers an
   optional chapter on adding and managing rackets. Closing it in any way — finishing,
   skipping, ✕, Escape — sets `User.onboardedAt` via `completeOnboarding`, so it never
   reopens on its own; "How it works" replays it — a button on the dashboard, and an
   entry in the header (an icon on wide screens, a line in the menu on narrow ones), so
   it is reachable from every page. Seeded users (the bootstrap admin, the dev roster)
   start out onboarded. Members who existed before the column was added have
   `onboardedAt = null` and get the tour once on their next visit too — deliberately,
   since none of them have seen it.
6. Admins cannot change their own approval status or drop their own admin role, and
   the last approved admin cannot be demoted — the club always keeps one.

The first user created by the seed script is `admin` + `APPROVED` (bootstrap) —
seeding bypasses better-auth (and so the invite gate) entirely; see §9.

## 4. Data model

```prisma
// better-auth managed: User, Session, Account, Verification
// NOTE: no Account.issuer. better-auth 1.7.0–1.7.2 added one and 1.7.3
// removed it; a leftover required column is never written, so every signup
// fails. Dropped when upgrading to 1.7.7. The CLI lags the library, so
// regenerate field lists from the installed package, not `@better-auth/cli`.
// User extended with:
//   role         String   @default("member")   (admin plugin)
//   banned, banReason, banExpires             (admin plugin)
//   status       String   @default("PENDING")  // PENDING | APPROVED | REJECTED
//   approvedAt   DateTime?
//   approvedById String?
//   locale       String?  // "en" | "de" — see §8, Locale routing
//   inviteToken  String?  // the invite this account was created with — see §9
//   onboardedAt  DateTime? // welcome tour seen (finished or dismissed) — see §3

model Racket {
  id            String   @id @default(cuid())
  ownerId       String
  owner         User     @relation(fields: [ownerId], references: [id], onDelete: Cascade)
  label         String   // "Blue Pure Drive" — how the owner recognises it
  brand         String?
  model         String?
  headSizeCm2   Int?     // 645, 660, 680 …
  stringPattern String?  // "16x19"
  gripSize      String?
  notes         String?
  archived      Boolean  @default(false)
  hidden        Boolean  @default(false)  // stand-in for a request with no racket — see below
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  requests      StringingRequest[]
}

model ClubString {
  id         String   @id @default(cuid())
  name       String   // "Luxilon ALU Power"
  gauge      String?  // "1.25"
  priceCents Int?     // the string cost of a job strung with it (§5a)
  active     Boolean  @default(true)  // hidden from new requests when false
  sortOrder  Int      @default(0)
  createdAt  DateTime @default(now())
  requests   StringingRequest[]
}

model StringingRequest {
  id            String   @id @default(cuid())
  racketId      String
  racket        Racket   @relation(fields: [racketId], references: [id])
  requesterId   String
  requester     User     @relation("requester", fields: [requesterId], references: [id])

  status        String   @default("REQUESTED")
  // REQUESTED -> ACCEPTED -> DONE -> COLLECTED, plus CANCELLED

  // what the member wants
  stringSource  String   // MEMBER | CLUB  (who provides the string)
  clubStringId  String?  // set when stringSource = CLUB
  clubString    ClubString? @relation(fields: [clubStringId], references: [id])
  ownStringName String?  // free text when stringSource = MEMBER
  tensionMain   Float    // kg
  tensionCross  Float?   // kg, null = same as main
  memberNotes   String?

  // operator side
  operatorId    String?
  operator      User?    @relation("operator", fields: [operatorId], references: [id])
  acceptedAt    DateTime?
  completedAt   DateTime?
  collectedAt   DateTime?
  operatorNotes String?
  usedStringName String? // what was actually used, prefilled on complete
  usedTensionMain  Float? // what was actually strung, prefilled from tensionMain
  usedTensionCross Float?
  // the three price parts, stamped on complete — never entered by the operator (§5a)
  stringPriceCents Int?  // ClubString.priceCents; null for the member's own string
  labourPriceCents Int?  // ClubSettings.labourPriceCents, reimbursed to the stringer
  rakeCents        Int?  // ClubSettings.rakeCents, kept by the club

  // controller side — orthogonal to the status machine below, not a transition
  paidAt   DateTime? // null = unpaid
  paidById String?
  paidBy   User?     @relation("paidBy", fields: [paidById], references: [id])

  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  events        RequestEvent[]
}

model RequestEvent {
  id        String   @id @default(cuid())
  requestId String
  request   StringingRequest @relation(fields: [requestId], references: [id], onDelete: Cascade)
  actorId   String
  actor     User     @relation(fields: [actorId], references: [id])
  fromStatus String?
  toStatus   String
  note      String?
  createdAt DateTime @default(now())
}

/// Append-only: a payout to a stringer for accumulated labour. Outstanding balance
/// is never stored — always SUM(StringingRequest.labourPriceCents where paidAt is
/// set) minus SUM(Reimbursement.amountCents), computed fresh on every read.
model Reimbursement {
  id          String   @id @default(cuid())
  operatorId  String
  operator    User     @relation("labourReimbursement", fields: [operatorId], references: [id])
  amountCents Int
  note        String?
  createdById String
  createdBy   User     @relation("reimbursementRecordedBy", fields: [createdById], references: [id])
  createdAt   DateTime @default(now())
}
```

`Invite` is specified in §9 and the six training-planner models in §13; both live in the
same `prisma/schema.prisma`.

**Racket tokens** (`RACKET_TOKENS_ENABLED=true`, off by default). Rackets are left in the
clubhouse with a numbered carabiner clipped on, so the stringer can tell whose is whose.
With the switch on, the request form requires the carabiner number, picked from a
dropdown of 1..N in which numbers in use are listed but disabled ("7 — vergeben"); with it off, the field disappears and any number sent is ignored.

- Carabiners are numbered 1..N. An admin sets N on the "Saiten" page (default 20, kept
  in the one-row `ClubSettings` table). Lowering N below a number in use is refused.
- A number is **in use** from "Beauftragt" until the racket is collected or the request
  cancelled, and then free for anyone — the same member included.
- `StringingRequest.activeToken` holds the number only while the request is open and is
  `@unique`, so the database refuses a second open request on a number even when two
  members submit at the same instant. `tokenNumber` keeps it afterwards as a record.
- The stringer's queue gets a sortable "Karabiner" column (shown whenever a listed job
  has one), and the search box matches the number.

**Requesting without a racket.** A member who has not added a racket can still request a
restring: the form drops the racket picker, and `createRequest` files the request under
that member's `hidden` stand-in racket (labelled "Mein Schläger" / "My racket"), creating
it on first use and reusing it after. Every racket server function skips hidden rackets,
so it never appears under "my rackets", cannot be opened, edited, archived or deleted,
and cannot be picked by id. Once the member adds a real racket, the picker offers only
that; requests already filed keep the stand-in.

Deleting a racket that has requests is blocked → archive instead, so history stays intact.
Archiving is in turn blocked while the racket still has an open request.

A `ClubString` is taken off the request form by deactivating it (`active = false`); it
is hidden on `/admin/strings` too unless "show deactivated" is on (`?inactive=true`). Deleting removes it for good, used or not, after a
confirmation dialog — but is refused while an open (`REQUESTED`/`ACCEPTED`) request
still uses it. Past jobs that used it get its name copied into `ownStringName` and
`clubStringId` cleared, so they keep showing what was strung; their prices were already
stamped on completion.

**String selection invariant** (enforced in the Zod schema and re-checked server-side):
`stringSource = CLUB` → `clubStringId` set, `ownStringName` null;
`stringSource = MEMBER` → `ownStringName` set, `clubStringId` null.
The one exception is a past CLUB job whose catalogue string was deleted later:
`clubStringId` null, `ownStringName` holds that string's name.

## 5. Status machine

```
REQUESTED --accept(operator)--> ACCEPTED --complete(operator)--> DONE --collect--> COLLECTED
    |                               |
    +-------- cancel(owner/admin) --+--> CANCELLED
```

- Only `REQUESTED` and `ACCEPTED` can be cancelled; the owner can cancel their own,
  admins can cancel any. **The admin half is server-side only** — no screen offers
  the button to anyone but the owner (§12).
- Cancelling asks for confirmation in a dialog. No reason is asked for or stored.
- `accept` claims the job for that operator; an operator can release back to `REQUESTED`.
  Release and complete are limited to the claiming operator — admins may act on any job.
- `complete` requires the actually used string and main tension (both prefilled from the
  request; the operator can correct them, e.g. when they had to substitute a string).
  The operator enters **no price**: the server stamps all three price parts (§5a).
- `collect` can be triggered by the operator (handed over) or the member (picked up).
- Every transition writes a `RequestEvent`. The current status is part of the update's
  `where` clause, so two operators racing for one job resolve to exactly one winner;
  the loser gets a localized "someone else changed this request" error.
- Paid state (§2, controller) is deliberately **not** a transition: it is set/reset on
  `DONE` or `COLLECTED` jobs only, and never moves the status.

## 5a. Pricing

What a member pays for one racket is the sum of three parts:

| Part        | Set by                                                 | Goes to                                                  | Own string? |
| ----------- | ------------------------------------------------------ | -------------------------------------------------------- | ----------- |
| String cost | admin, per string (`ClubString.priceCents`)            | the club, which bought the string                        | **skipped** |
| Labour      | admin, one flat rate (`ClubSettings.labourPriceCents`) | reimbursed to the stringer (§4 `Reimbursement`)          | charged     |
| Club rake   | admin, one flat rate (`ClubSettings.rakeCents`)        | kept by the club for machine maintenance and app hosting | charged     |

```
club string: total = string cost + labour + rake
own string:  total =               labour + rake
```

- Labour and rake are the same for every stringer and every racket. Both are set on
  `/admin/strings`, next to the catalogue prices; either may be left unset, which
  counts as zero.
- **The stringer changes nothing.** The "mark as done" form has no price fields, and
  `completeRequest` ignores any price it is sent. It copies the three parts onto the
  job (`stringPriceCents`, `labourPriceCents`, `rakeCents`) at that moment, so later
  price changes leave finished jobs alone.
- The request form shows the member the total for each option before they submit;
  the request detail and `/billing` show the three parts and the total.
- Stringer payouts count only labour, on paid jobs. String cost and rake stay with
  the club.

## 6. Routes

| Route                                         | Access                    | Purpose                                                                                                       |
| --------------------------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `/`                                           | public                    | Landing → redirects to `/dashboard` when signed in                                                            |
| `/login`                                      | public                    | email + password                                                                                              |
| `/signup`                                     | public, needs `?token=`   | invite-gated — see §9                                                                                         |
| `/pending`                                    | authed, PENDING           | "waiting for approval"                                                                                        |
| `/imprint`, `/privacy`                        | public                    | Impressum (§ 5 ECG, § 25 MedienG) and privacy notice (Art. 13 GDPR), linked in the footer of every page — §17 |
| `/dashboard`                                  | member                    | my open requests + quick "new request"; operator (jobs waiting) and admin (pending members) panels            |
| `/rackets`, `/rackets/new`, `/rackets/$id`    | member                    | manage own rackets                                                                                            |
| `/requests`, `/requests/new`, `/requests/$id` | member                    | own requests + detail/timeline                                                                                |
| `/queue`                                      | operator                  | open + own claimed jobs, filter by status, sortable/searchable table                                          |
| `/queue/$id`                                  | operator                  | accept / complete / collect                                                                                   |
| `/billing`                                    | operator OR controller    | every restrung racket: string/labour/rake/total price, paid state, sortable/searchable table                  |
| `/billing/payouts`                            | controller                | labour earned/reimbursed/outstanding per stringer, reimbursement ledger                                       |
| `/invites`                                    | operator (admin inherits) | create/list/revoke invite links — see §9                                                                      |
| `/training`                                   | coach                     | redirects to the roster                                                                                       |
| `/training/people`, `/training/people/$id`    | coach                     | trainee/trainer roster + weekly availability                                                                  |
| `/training/plans`, `/training/plans/$id`      | coach                     | solver knobs, saved runs, groups and who was left out                                                         |
| `/admin/members`                              | admin                     | approve, reject, set roles                                                                                    |
| `/admin/strings`                              | admin                     | club string catalogue: add, edit price, deactivate, delete; labour and club rake (§5a); bank account (§16)    |
| `/help`                                       | member                    | every feature explained, filtered to the reader's roles; restarts the tour                                    |
| `/api/auth/$`                                 | public                    | better-auth handler (exists)                                                                                  |

Guards live in one place: `beforeLoad` on a `_authed` pathless layout route that loads
the session, checks `status === APPROVED`, and a `requireRole()` helper for
`/queue`, `/admin`, `/invites`, `/training` and `/billing/payouts`. `/billing` uses
`requireAnyRole()` instead, since operator and controller are independent specialties
rather than one ranked above the other. Every server function re-checks — the route
guard is UX, the server function is the security boundary. The server-side
middlewares in `src/lib/auth-middleware.ts` are `authed` (any session, even PENDING —
used only for the locale functions), `member`, `operator`, `controller`, `coach`,
`admin` and `billingView` (operator **or** controller).

**CSRF.** Server functions are same-origin RPC endpoints, and every mutation is one.
`src/start.ts` registers TanStack Start's CSRF middleware, scoped to
`handlerType === 'serverFn'`: Start only adds it by default when an app declares no
start instance of its own, and this one does (for the locale middleware, §8). Ordinary
document navigations and the better-auth API routes are not affected.

Owner-scoped reads (rackets, own requests) answer a foreign id with a `404`, never a
`403` — a guessed id should not even confirm that the row exists.

`src/components/breadcrumbs.tsx` renders a trail under the header on every authed
page, driven by TanStack Router's `useMatches()` rather than a hand-maintained tree:
a `LABELS` map keyed by route id supplies the crumb text (a static message, or a
function reading the match's own `loaderData` for a detail page's entity name), and
the link target is always the match's own `pathname` — never hand-typed. A route id
mapped to `null`, or missing from the map entirely, contributes no crumb, which is
how pathless layouts (`/billing`, `/queue`, `/admin`) and the public shell stay out of
the trail without special-casing them. Absent on the dashboard itself and on `/`,
`/login`, `/signup`, `/pending` — a one-item trail points nowhere useful.

## 7. Out of scope for v1

Push/email notifications, actual payment/settlement (the app records prices, a paid flag
and stringer payouts — money itself changes hands outside it), stock levels for club
strings, photos of rackets, statistics/exports, password reset by email, tracking physical
drop-off/handover of the racket, multi-club/tenant support, a dark mode.

## 8. Locale routing

German (`de`) is the base locale — plain paths (`/rackets`) are German, English gets
the prefix (`/en/rackets`). Paraglide's `url` strategy drives this; two pieces make it
work with the route tree, which only knows the plain paths:

- `src/router.tsx` sets `rewrite.input` = `deLocalizeUrl` and `rewrite.output` =
  `localizeUrl`, so `/en/rackets` matches the `/rackets` route and every `<Link>`
  renders back with the prefix.
- `src/start.ts` registers a global request middleware running `paraglideMiddleware`,
  which establishes the per-request locale on the server. Without it `getLocale()`
  falls back to the base locale during SSR and the output rewrite strips the prefix —
  turning every English URL into a redirect to its German twin.

  Server function calls (`/_serverFn/...`) are the exception: that endpoint carries no
  locale prefix of its own, so the `url` strategy has nothing to read there. The
  middleware passes `effectiveRequestUrl` pointing at the `Referer` header for those
  requests specifically (`handlerType === 'serverFn'`), since that's the calling page's
  URL and does carry the prefix. Without this, every `m.*()` call made inside a server
  function's handler — a business-rule error, a Zod validation message — would always
  render in the base locale, regardless of which locale the calling page was actually
  in. This only steers locale detection; `next()` still dispatches the real, untouched
  request either way.

  Every user-facing error thrown from a server function, and every validation message
  in `src/lib/schemas.ts`, goes through `m.*()` for exactly this reason. Schemas are
  built once at module load and reused across every request, so a plain string (or an
  `m.foo()` call made directly at the schema definition) would freeze into whichever
  locale was active at that first import — `schemas.ts` uses Zod's `{ error: () => m.foo() }`
  function form instead, which defers the call to parse time.

**Per-account language.** `User.locale` (`en` | `de` | `null`) follows a signed-in
member across devices:

- The header's toggle calls `setMyLocale` — an unconditional overwrite, since
  clicking it is a deliberate choice.
- Login and signup both call `recordInitialLocale` with whatever locale the page
  happened to be in — but that write only takes if `locale` is still `null`
  (`updateMany({ where: { id, locale: null } })`), so it can never clobber a
  preference set explicitly on another device.
- Root's `beforeLoad` compares `user.locale` against the current request's
  resolved locale on every navigation; a mismatch throws a `redirect()` to the
  localized equivalent of the current path. This is what makes a saved preference
  "follow" a member to a new browser or device — the first page they land on
  redirects once, to the locale they last chose, then nothing further happens
  since the two now match.

## 9. Invite-gated signup

There is no public signup — `/signup` refuses to create an account without a
valid, unexpired, unused, unrevoked invite token in the URL (`?token=…`).
`/invites` (operator or admin) creates and lists them; expiry is set per invite
at creation, defaulting to 24h.

```prisma
model Invite {
  id          String    @id @default(cuid())
  token       String    @unique
  createdById String
  createdBy   User      @relation(fields: [createdById], references: [id])
  expiresAt   DateTime
  usedAt      DateTime?
  usedById    String?
  usedBy      User?     @relation(fields: [usedById], references: [id])
  revokedAt   DateTime?
  createdAt   DateTime  @default(now())
}
```

**The enforcement is in better-auth, not just the route.** `src/lib/auth.ts`
sets `user.validateUserInfo`, a gate that runs _inside_ `createUser`, before any
row is written — confirmed against
`node_modules/better-auth/dist/db/internal-adapter.mjs` rather than assumed.
For `source.method === 'email-password'` it atomically claims the invite
(`updateMany({ where: { token, usedAt: null, revokedAt: null, expiresAt: { gt:
now } }, data: { usedAt: now } })`); a 0-row result means invalid/used/expired/
revoked, and returning `{ error }` from the hook surfaces as a real `403` with
a custom message (`node_modules/better-auth/dist/utils/validate-user-info.mjs`)
— no half-created account on rejection, no separate follow-up call needed to
"undo" a bad signup. `databaseHooks.user.create.after` then stamps `usedById`
once the new user's id is committed.

better-auth's own `organization` plugin has an invitation system, but it's the
wrong shape for this: invitations there are pinned to a specific email and can
only be _accepted_ by an already-signed-in session
(`node_modules/better-auth/dist/plugins/organization/routes/crud-invites.mjs`)
— exactly backwards from "an anonymous stranger uses a link to create an
account." Adopting it would also drag in organizations/teams/org-scoped roles
for an app with exactly one club. The `one-time-token` plugin is session
transfer for an already-authenticated user, not a pre-signup invite, and
defaults to a 3-minute expiry. Built custom instead.

`/signup`'s loader calls the public `checkInvite` server function to show
"this invite is no longer valid" before rendering a form — UX only; it cannot
be trusted as the boundary, since it's a plain unauthenticated `GET` a client
could just not call. The real gate is `validateUserInfo`, checked regardless.

`prisma/seed.ts` creates users via a direct `prisma.user.create()`, bypassing
better-auth (and so the invite gate) entirely — correct for a bootstrap script,
worth remembering if this ever needs to change.

## 10. Decisions

| Question        | Decision                                                                                                               |
| --------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Status set      | `REQUESTED → ACCEPTED → DONE → COLLECTED` (+ `CANCELLED`), no separate in-progress step                                |
| String choice   | Club catalogue (`ClubString`, admin-maintained) **or** own string as free text                                         |
| Email at signup | Required — real address, enables notifications/reset later                                                             |
| Language        | Keep `en` + `de` switchable; `de` is the base locale, per-account preference persists                                  |
| Price           | String cost + labour + club rake, all admin-set and stamped on complete; no string cost for an own string (§5a)        |
| Payment         | A paid flag per job (controller), plus an append-only labour payout ledger per stringer — no real settlement           |
| Light theme     | Committed light-only palette; no dark mode or user toggle                                                              |
| Racket handover | Not tracked in the app                                                                                                 |
| Due date        | None — the queue is first come, first strung (oldest request first); the `neededBy` column was dropped                 |
| Cancel reason   | Not asked for; cancelling is one confirmation                                                                          |
| Other string    | The stringer corrects the used string on completion; the member is not asked first and sees it on the job page         |
| Signup access   | Invite-link only, single-use, expiry configurable (default 24h) — custom, not better-auth's `organization` invitations |

## 11. What is built

Everything in §2–§10, §13, §14 and §16, except the items listed in §12. All feature and
spike branches are merged into `main`.

### Beyond the v1.0 spec

| Added                        | Where / notes                                                                                                      |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Controller role, paid state  | §2, §5 — `/billing`; `setRequestPaid` only on `DONE`/`COLLECTED`                                                   |
| Labour payout ledger         | §4 `Reimbursement` — `/billing/payouts`; balance recomputed server-side so a stale screen can't pay out twice      |
| Invite-gated signup          | §9 — replaces open signup                                                                                          |
| Coach role, training planner | §13 — roster, availability timetable, standalone solver, saved plans with a week view                              |
| Per-account language         | §8 — German default, preference follows the member across devices                                                  |
| Localized errors             | §8 — server-thrown errors and Zod messages follow the calling page's locale, not just the UI chrome                |
| Sortable, searchable tables  | `/queue` and `/billing` — shared `src/components/sortable-table.tsx`; missing values sort last in either direction |
| Breadcrumbs                  | §6 — on every authed page, derived from the route matches                                                          |
| Confirmation dialogs         | Radix `Dialog` (cancel request), anchored below the header rather than centred — §14                               |
| Light theme                  | §14 — replaces the prototype's dark workshop look                                                                  |
| Simplified racket form       | Name only by default; brand/model/head size/pattern/grip behind "add more details"                                 |
| Dashboard panels             | Jobs waiting (operators), members awaiting approval (admins)                                                       |
| Developer tooling            | §15 — seeded demo data, data reset, dev quick-login                                                                |
| Welcome tour                 | §3 — first-visit walkthrough of requesting a restring, optional racket chapter; replayable from the dashboard      |
| Help page                    | §6 — `/help`: sections per feature, shown only for the roles that can use them; carabiner topics only when on      |

### Tests

None of these run in CI — there is no CI configuration in the repo.

| Command               | What it covers                                                                                                                                                                                                                                     |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm test:ui`        | Playwright, in a real browser, through the screens a person uses. Add `--ui` to watch a run step by step. See "Browser tests" below                                                                                                                |
| `pnpm test:e2e`       | Real HTTP stack (better-auth + server-function RPC) against a **running dev server**: auth, invite gate, approval, rackets, strings, request lifecycle, paid state, payout ledger, locale persistence, training planner, rejection revoking access |
| `pnpm test:solver`    | The grouping solver in isolation — hard rules, determinism, unplaced reasons                                                                                                                                                                       |
| `pnpm test:timetable` | Timetable cell⇄slot conversion, configurable window, out-of-window preservation, lane packing                                                                                                                                                      |
| `pnpm test:epc`       | Payment QR payload line by line, reference length and job code, IBAN/BIC checks (§16)                                                                                                                                                              |

The e2e script mutates the dev database; run `pnpm db:reset-data && pnpm db:seed`
before a second run, or balance assertions in the payout section fail on leftovers.

### Browser tests

`tests/ui/`, configured in `playwright.config.ts`. Each workflow is one test, split into
`test.step`s so `pnpm test:ui --ui` reads as an outline you can step through.

- **Isolated.** Its own server on :4100 and its own `e2e` schema in the dev database,
  dropped and migrated afresh each run, so it never touches `pnpm dev` on :4000 or the
  dev data in `public`, and both can run at once (`tests/ui/env.ts`).
- **Production build.** The web server runs `pnpm build`, then the built server — no
  Vite dependency optimiser reloading the page mid-test, and it tests what ships. After
  editing `src/`, restart `--ui` to rebuild.
- **Known state.** `tests/ui/global-setup.ts` empties the tables, pushes the schema,
  then seeds the bootstrap admin and a test string catalogue (`tests/ui/seed-catalogue.ts`). Rows are wiped before the
  push so a schema change never has data to lose — Prisma refuses
  `--accept-data-loss` when an AI agent runs it.
- **Re-runnable.** Each test invents its own members (`newMember()`), since in `--ui`
  mode the database is reset when the UI opens, not on every re-run.
- **Copy-proof selectors.** Controls are found by role and label, with the text read
  from `messages/de.json` through `t()` — wording changes don't break tests, and a
  mistyped key fails the type check.

| Workflow                                                                                                  | File                                        |
| --------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| Newcomer joins via invite link, gets approved, walks the welcome tour, adds a racket, requests a restring | `new-member-onboarding.spec.ts`             |
| Help shows a member, a stringer and an admin only the sections their roles can use                        | `help-shows-what-your-roles-can-do.spec.ts` |
| Stringer finds a job in the queue, accepts it, completes it with notes, prices from the club              | `stringer-completes-a-job.spec.ts`          |
| Controller marks a job paid, is refused an overpayment, pays the stringer part of their labour            | `controller-reimburses-a-stringer.spec.ts`  |
| Member with no racket requests a restring; the stand-in never shows under "my rackets"                    | `request-without-a-racket.spec.ts`          |
| Carabiner in use is refused, the admin can't lower the count below it, and it is free again after pickup  | `racket-tokens.spec.ts`                     |

Only the onboarding test creates people through the UI. The others start from a state
written straight into the database by `tests/ui/fixtures.ts` — "a stringer exists, a
member has an open request" — so each drives only the part it is about.

### Code map

| Area                  | Files                                                                                                                  |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Auth config           | `src/lib/auth.ts`, `src/lib/auth-client.ts`                                                                            |
| Session (server-only) | `src/lib/auth.server.ts` — split out so Prisma never reaches the client bundle                                         |
| Server fn guards      | `src/lib/auth-middleware.ts` (`authed` / `member` / `operator` / `controller` / `coach` / `admin` / `billingView`)     |
| Route guards          | `src/lib/guards.ts`, `src/routes/_authed.tsx` and the `queue`, `admin`, `billing`, `invites`, `training` layout routes |
| Request middleware    | `src/start.ts` — CSRF + per-request locale                                                                             |
| Roles                 | `src/lib/roles.ts` (cascade)                                                                                           |
| Domain rules          | `src/lib/status.ts` (state machine), `src/lib/schemas.ts` (Zod), `src/lib/training.ts` (timetable maths)               |
| Solver                | `src/solver/` — framework-free                                                                                         |
| Server functions      | `src/server/*.functions.ts`                                                                                            |
| Screens               | `src/routes/**`, shared pieces in `src/components/`                                                                    |
| i18n                  | `messages/{en,de}.json`, `src/lib/labels.ts`                                                                           |
| Theme                 | `src/styles.css`                                                                                                       |

## 12. Still missing

### Spec and code disagree

Each needs a decision: change the code to match the spec, or accept the code and drop
the sentence from the spec.

| Spec says                             | Code does                                                                                                 | Where                                 |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| Admins can cancel any request (§5)    | Server allows it; **no screen shows the button** — `/requests/$id` only for the owner, `/queue/$id` never | `requests/$id.tsx`, `queue/$id.tsx`   |
| A rejected member cannot sign in (§3) | Sessions are deleted, but they **can sign in again** and land on `/pending`'s "not approved" screen       | `members.functions.ts`, `pending.tsx` |

### Not built yet

- **Invite revocation still uses the browser's native `confirm()`** (`invites.tsx`),
  unlike cancel, which moved to a localized Radix dialog.
- **Dashboard panels for controllers and coaches.** Operators and admins get a panel;
  the other two roles get only their own requests.
- **CI.** All test scripts are manual; the HTTP e2e script additionally needs a
  running dev server.
- **Browser tests cover four workflows so far** (onboarding, request without a racket, stringer completing a
  job, controller reimbursing a stringer). Still to write: member collects or
  cancels, admin rejects a member, coach builds a roster and solves a plan, locale
  switching.
- **Email-based features.** §10 requires a real email address "to enable
  notifications/reset later"; both remain out of scope (§7), so the address is
  collected but unused.

### Known limitations

- `fetchSession` runs on every navigation. Correct and always fresh, but it is one RPC
  per navigation — worth caching if the club ever outgrows it.
- The solver is greedy: deterministic and explainable, not guaranteed optimal (§13).
- Plan week view counts lanes per weekday, so one clash on a day draws every group
  that day at half width (§13).
- The availability timetable makes every cell a tab stop (196 at the default
  08:00–22:00 window); the exact-times form is the keyboard path. A roving tabindex
  would fix it.
- Server-side Zod rejections (only reachable by bypassing the forms) arrive wrapped in
  the framework's JSON issue envelope rather than as a plain sentence; the message
  inside is localized.
- `pnpm format` runs prettier over the whole repo, including the vendored skill docs
  in `.agents/` — `.prettierignore` only lists lockfiles.

### Spike decisions pending

§13 and §14 were built as spikes to evaluate, then merged. Open questions:

- **Availability editors.** The timetable and the exact-times form both sit on the
  person page so they can be compared. Keep both, or drop one?
- **Timetable interaction.** Drag-painting uses pointer capture and
  `touch-action: none`. The conversion logic is unit-checked and the rendered markup was
  inspected, but no test drives an actual drag — mouse or touch.
- **Light theme.** Every palette pair passes WCAG AA by calculation; no test checks how
  it renders, so it needs a review by eye.

## 13. Training planner

Built as a spike, now merged into `main`; the evaluation questions still open are in §12.

A second, largely independent section: plan weekly group training and assign
trainees to trainers. Coaches only (§2); admins inherit the role.

```prisma
model TrainingPerson {        // standalone — not a User
  id String @id @default(cuid())
  name String
  kind String                 // TRAINEE | TRAINER
  ball String?                // RED | ORANGE | GREEN | YELLOW — trainees only
  strength Float?             // 0 (beginner) … 5 — trainees only
  notes String?
  archived Boolean @default(false)
}
model TrainingAvailability {  // weekly recurring, cascades with the person
  personId String
  weekday  Int                // 0 = Monday … 6 = Sunday
  startMin Int                // minutes from midnight
  endMin   Int
}
model TrainingPlan {          // one solver run, with the knobs it ran on
  name String
  createdById String          // → User
  minGroupSize Int  maxGroupSize Int  strengthSpread Float
  sessionMinutes Int  slotStepMinutes Int  courtCount Int
}
model TrainingGroup        { planId String  trainerId String  weekday Int  startMin Int  endMin Int  ball String  court Int }
model TrainingGroupMember  { groupId String  personId String }              // @@unique([groupId, personId])
model TrainingPlanUnplaced { planId String  personId String  reason String } // @@unique([planId, personId])
```

### Roster

`TrainingPerson` is **standalone** — it is not a `User` relation. Juniors have no club
login, so a coach types the roster in: name, `kind` (`TRAINEE` | `TRAINER`), and for
trainees a `ball` (`RED` | `ORANGE` | `GREEN` | `YELLOW`) plus a `strength` from 0
(beginner) to 5. Trainers are graded by neither. People are archived rather than
deleted once a plan references them, so old plans still name everybody.

`TrainingAvailability` is **weekly recurring**, not calendar dates: `weekday`
(0 = Monday … 6 = Sunday) plus `startMin`/`endMin` as minutes from midnight. The plan
is one typical week, repeated through the season.

### Entering availability

Two editors sit on the person page, deliberately, so the pair can be compared:

- **Timetable** (`src/components/availability-grid.tsx`) — a Mon–Sun grid of half-hour
  cells. Drag to paint, drag over filled cells to erase; the cell the stroke starts on
  decides which, so one gesture never flip-flops. It saves once per stroke via
  `setAvailability`, which replaces the person's whole week.

  Which hours it draws is configurable (default 08:00–22:00). The two time pickers live
  in the `/training` header (`src/components/grid-window.tsx`), which owns the setting
  and hands it to both timetables through context, so the roster and the solved plans
  always agree on it. It is remembered per browser in `localStorage` — a view
  preference, not club data. The window is snapped to the step and always keeps at least
  one row, so a half-typed time cannot produce an empty or inverted grid. A "fit to
  entered times" button on the person page widens it to whatever that person has.

  Because a save rewrites the whole week, anything **outside** the drawn window is read
  off the existing slots and written back untouched. Without that, narrowing the window
  and then painting would silently delete a Saturday morning nobody could even see.

- **Exact times** — the original day + from + to form, kept for anything the grid cannot
  express.

Cells convert to slots by merging touching runs, and slots convert to cells by taking
only those lying **entirely inside** a slot. Rounding outwards would claim time nobody
offered and the planner would then schedule sessions they cannot attend. A week that the
grid cannot represent exactly (17:10, or times outside the drawn window) is flagged
above the grid rather than being quietly trimmed on the next save.
`pnpm test:timetable` covers the conversion both ways.

### The solver

Lives in `src/solver/` and is a **separate module**: plain data in, plain data out, no
Prisma, no React, no framework imports. `pnpm test:solver` checks it in isolation.

Inputs (all stored on the plan that produced them, so an old run still explains itself):

| Knob              | Meaning                                             |
| ----------------- | --------------------------------------------------- |
| `minGroupSize`    | below this a group is not formed at all             |
| `maxGroupSize`    | hard cap per group                                  |
| `strengthSpread`  | largest allowed gap between weakest and strongest   |
| `sessionMinutes`  | how long one session runs                           |
| `slotStepMinutes` | sessions may start only on this grid, from midnight |
| `courtCount`      | how many groups may run at the same time            |

Hard rules the result never violates: one ball type per group; strength spread within
the limit; size within the bounds; trainer and every trainee free for the whole session;
a trainer runs one group at a time; at most `courtCount` groups overlap; a trainee is
placed **at most once**.

The strategy is greedy — repeatedly commit the single best group formable anywhere in
the week (largest, then tightest spread, then earliest), until nothing reaches the
minimum. Not guaranteed optimal, but fast, explainable and **deterministic**: the same
roster always yields the same plan, including when the input order changes, which
matters when a coach re-runs after a small edit.

Whoever is left over is stored with a reason — `NO_AVAILABILITY`,
`NO_TRAINER_OVERLAP` or `NO_COMPATIBLE_GROUP` — since that half of the result is the
part a coach has to act on.

### Plans

Every solve is saved (`TrainingPlan` + `TrainingGroup` + `TrainingGroupMember` +
`TrainingPlanUnplaced`), so two sets of knobs can be compared rather than one
overwriting the other. Plans are immutable: re-solving writes a new one. A coach can
delete a plan; its groups and unplaced list cascade with it. Archived people are left
out of new solves but still named in old plans.

A plan is shown twice: as a week timetable
(`src/components/schedule-timetable.tsx`) over the same configurable window, and as the
per-day list beneath it. The timetable positions blocks **by the minute** rather than
snapping them to the half-hour rows, because a plan's session length and start grid are
its own knobs and need not line up with the rows behind them. Groups running at the same
time are spread across side-by-side lanes (`assignLanes`) the way a calendar shows two
simultaneous meetings; lanes are counted per weekday, so a day with one clash draws all
of its groups at half width. Anything outside the window is counted in a note above the
grid — the list below is always complete.

## 14. Look and feel

The app wears the Royal Tennisclub Bezau brand. `misc/BRAND.md` is the source of truth;
`misc/rtc-theme.css` holds its palette and font tokens and is imported by
`src/styles.css`, which maps them onto the shadcn tokens in `:root`.

- **Palette.** Cream page (`--background`), sand cards (`--card`), court-green text
  (`court-900`), sage for secondary text and borders, terracotta (`--color-brand`) as the
  one accent and crown red for destructive actions. No gradients, no emoji.
- **Type.** Headings and card titles are Playfair Display 600, uppercase, letter-spaced
  — set once in the base layer, so a heading needs no weight or tracking utilities. UI text
  is Inter. Small labels are uppercase with 0.16em tracking. Both fonts are served by the
  app itself (`@fontsource-variable/*`, imported at the top of `src/styles.css`), never
  from Google: Google Fonts would hand every visitor's IP address to Google, which
  Austrian courts and the DSB treat as a GDPR breach without consent. The CSP allows
  fonts and styles from `'self'` only.
- **Logo.** `src/components/club-logo.tsx`: the badge (`misc/rtc-racket-badge.svg`, the
  Restringing service mark) left of "ROYAL TENNISCLUB BEZAU" in terracotta Playfair;
  stacked and centred on the sign-in screens. The same SVG is the favicon. Swap the one
  import once there is an SVG of the full crest.
- **Tokens over utilities.** Components reach for `bg-card`, `text-muted-foreground`,
  `border-border`, `bg-primary`, `hover:bg-primary-hover` rather than raw colours. Where
  a palette step is meant (status badges, callouts) it is a brand scale — `terracotta-*`,
  `sage-*`, `court-*`, `crown` — never a stock Tailwind colour. The one exception is the
  training ball badges, which show the real ball colours.
- **Fill vs ink.** `--primary` (terracotta) is a fill under white text (4.8:1). Terracotta
  as text on cream is only allowed large or bold, so links and highlights use
  `--primary-ink` (terracotta-700). Muted text is sage-700; sage-500 is never text.
- **Buttons** are pills (`rounded-full`), at least 44px tall for the primary action.
  Cards are `rounded-2xl` on sand with a hairline shadow.
- **Meaning, not colour.** Status badges are tints: requested court, on the machine
  terracotta, ready sage, collected neutral, cancelled crown. "Good" callouts are sage,
  "attention" terracotta, "negative" crown on a terracotta tint.
- **Header.** Logo bar, with the nav tabs on a second row on desktop — a staff account
  carries up to nine tabs, which never fit beside the wordmark. Below `lg` they collapse
  into the menu button.
- **Base size** is 104.2% (16.67px), half a point above the browser default, as a
  percentage so a reader who has already raised their own base size keeps the increase.

Every text pair clears WCAG AA: muted sage-700 on sand 5.7:1, white on terracotta 4.8:1,
terracotta-700 links on sand 6.1:1. Input borders are sage-600 (≥4:1) for the 3:1 UI-mark
rule.

### Interaction patterns

- **Dialogs** use the shared Radix `Dialog` primitive (`src/components/ui/dialog.tsx`),
  anchored a fixed distance below the header (`top-20`) rather than vertically centred,
  so a dialog does not jump as its own content changes height. A max height with
  scrolling keeps tall dialogs on screen. Confirmations go through a dialog, never the
  browser's `confirm()` — one holdout remains (§12).
- **Tables** that list many rows (`/queue`, `/billing`) sort by clicking a column header
  and filter through a free-text search box, both client-side over the loaded rows.
  Sort state is local to the page and resets on navigation.
- **Breadcrumbs** under the header on every authed page (§6).

## 15. Developer tooling

| Command              | What it does                                                                                                                                                    |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm db:seed`       | Idempotent. Only the bootstrap admin, plus the dev quick-login roster when that is enabled. String catalogue, prices and training roster are entered in the app |
| `pnpm db:reset-data` | Deletes every user, racket, request, invite, payout, training row and club string, and the club settings. Follow with `pnpm db:seed`                            |
| `pnpm test:*`        | See §11                                                                                                                                                         |

**Bootstrap admin.** `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` / `SEED_ADMIN_NAME`,
defaulting to `admin@rtc.local` / `changeme123` / `Club Admin`. Change the password on
any real deployment.

**Dev quick-login.** With `DEV_QUICK_LOGIN_ENABLED=true`, `/login` shows one-click
sign-in for a fixed seeded roster — admin, two stringers, a coach and three members —
sharing `DEV_QUICK_LOGIN_PASSWORD`. The server function re-checks the flag itself, so a
hidden button is not the only barrier. Never enable it on a deployment.

**Agent tooling.** `AGENTS.md` describes loading TanStack's intent skills before larger
changes; `.agents/skills/` vendors the Prisma skill docs (see the formatting caveat in
§12).

## 16. Payment QR code (Zahlschein)

**Status: built.** The decisions taken on the open questions are listed at the end.

Members pay for a restring by bank transfer, and typing IBAN, amount and reference by
hand is where payments go wrong or get forgotten. Once a job has a price, the app shows
an **EPC QR code** ("GiroCode", what Austrian and German banking apps open when you
choose "Zahlschein scannen" or "QR-Code scannen") with everything filled in: recipient,
IBAN, amount and a reference the controller can match on the bank statement.

The QR code only fills in the transfer. Nothing in the app learns that the money
arrived: a controller still marks the job paid on `/billing` after seeing it on the
statement (§2, §10 "Payment").

### Where it appears

A job **shows payment details** when all of these hold:

- its status is `DONE` or `COLLECTED`, so the price has been stamped (§5a)
- it is unpaid (`paidAt` is null)
- its total is above zero
- the club has entered its bank account (below)

| Where                                 | Who                     | Why                                                                                        |
| ------------------------------------- | ----------------------- | ------------------------------------------------------------------------------------------ |
| `/requests/$id`, the member's own job | the member              | pay from home, any time after the job is done                                              |
| `/queue/$id`, at handover             | the stringer (operator) | at the court, the member scans the QR code off the stringer's phone with their banking app |

Once the job is marked paid, the block disappears and the job summary's "Bezahlt"
badge says it is settled. With no bank account entered, nothing is shown; there is no
half-filled QR code.

**A member can't scan their own screen.** On a phone the member is usually looking at
the very screen they'd need to scan. So the block shows, next to the QR code, each
field on its own line with a copy button: recipient, IBAN (grouped in fours), amount
and reference. On a phone the copy fields come first and the QR code below them; from
`sm:` up the QR code sits beside them.

### What goes into the code

The payload follows EPC069-12 (version 002, UTF-8), one field per line, separated by
`\n`:

| #   | Field          | Value                                                                |
| --- | -------------- | -------------------------------------------------------------------- |
| 1   | Service tag    | `BCD`                                                                |
| 2   | Version        | `002` (BIC optional inside the EEA)                                  |
| 3   | Character set  | `1` (UTF-8)                                                          |
| 4   | Identification | `SCT` (SEPA credit transfer)                                         |
| 5   | BIC            | `ClubSettings.paymentBic`, or empty                                  |
| 6   | Recipient      | `ClubSettings.paymentRecipient`, at most 70 characters               |
| 7   | IBAN           | `ClubSettings.paymentIban`, uppercase, no spaces                     |
| 8   | Amount         | `EUR` + the job's total with a dot and two decimals, e.g. `EUR32.50` |
| 9   | Purpose        | empty                                                                |
| 10  | Structured ref | empty                                                                |
| 11  | Remittance     | the reference text below, at most 35 characters                      |
| 12  | Info           | empty                                                                |

- The whole payload must stay within 331 bytes. Umlauts in names count as two.
- The QR code uses error correction level M, as EPC069-12 requires.
- The amount is `totalPriceCents(string, labour, rake)` from the stamped parts. It is
  never recomputed from today's prices.

**Reference text:** `RTC-<code> <member name>`, for example
`RTC-7K3M9Q2A Anna Gruber`.

- `<code>` is the last 8 characters of the request id, uppercased. It is short enough
  to read out loud, and a collision is very unlikely at club scale.
- The member name is cut short if the text would pass 35 characters. EPC069-12
  allows 140 for remittance text, but `eu-payment-qr` caps the reference at 35, and
  its 140-character `message` goes to line 12, which banks don't carry into the
  transfer. The job code always survives the cut.
- `/billing` search also matches `RTC-<code>`. A controller can paste the reference
  from the bank statement and land on the job.

The QR code and the copy fields always show the same values, both from one server
response.

### The club's bank account

Three new optional columns on `ClubSettings` (one migration):

```prisma
paymentRecipient String?   // account holder, e.g. "Tennisclub RTC"
paymentIban      String?   // stored uppercase, without spaces
paymentBic       String?   // optional
```

- The admin edits them on `/admin/strings`, in a new "Bankverbindung" card next to the
  club prices.
- Leaving recipient or IBAN empty switches the feature off.
- The form checks the IBAN's mod-97 checksum and its country-specific length before it
  saves, and shows it grouped in fours.
- The BIC, if entered, must be 8 or 11 characters.

All of the money goes to this one account. That matches §5a: the club receives string
cost, labour and rake, and pays labour back to the stringer through the payout ledger.

### Implementation notes

- [`eu-payment-qr`](https://www.npmjs.com/package/eu-payment-qr) builds the payload
  and validates IBAN (country length, mod 97) and BIC. `src/lib/payment.ts` wraps it:
  job code, reference, the 331-byte check, and the IBAN/BIC checks the admin form and
  the server schema share.
- `getRequest` (used by `/requests/$id` and `/queue/$id`) returns a `payment` object
  (`{ recipient, iban, bic, amountCents, reference, payload }`) or `null`.
  `paymentDetailsFor` in `src/lib/payment.server.ts` is the one place that decides.
- `src/components/payment-details.tsx` draws the QR code client-side as an inline
  `<svg>`. [`uqr`](https://www.npmjs.com/package/uqr) only computes the module grid;
  React draws one `<path>`. There is no `innerHTML` and no `data:` image, so the
  Content-Security-Policy in `src/lib/security-headers.ts` needs no change.
- Both packages were installed under the 7-day minimum release age, and
  `eu-payment-qr`'s source was read first: no dependencies, no install scripts, no
  network access.
- Copy buttons use `navigator.clipboard.writeText` and switch to "Kopiert" for two
  seconds, like the invite link. Each has an accessible name ("IBAN kopieren"). The
  IBAN is copied without spaces, the amount as `33,00` without the euro sign.

### Tests

- **Unit** (`scripts/epc-check.ts`, run as `pnpm test:epc`):
  - payload line by line, with and without a BIC, read back with `eu-payment-qr`'s
    parser
  - an IBAN with spaces and lowercase letters is normalized
  - a bad IBAN checksum or length is refused, and no payload is built for it
  - a name with umlauts stays within 331 bytes
  - a long name is cut to 35 characters, keeping the job code
  - the job code is found in a pasted reference
- **Browser** (`tests/ui/member-pays-by-qr-code.spec.ts`, at `PHONE` width):
  - the admin enters the bank account, and an invalid IBAN is refused
  - on a finished, unpaid job the member sees the QR code and the copy fields with
    the right IBAN, amount and reference, with no horizontal overflow; copying the
    IBAN and the amount puts them on the clipboard
  - the stringer sees the same block on `/queue/$id`
  - the reference pasted into the `/billing` search finds the job, which is marked
    paid, and the block disappears
  - with the bank account removed, no block is shown

### Out of scope

- Confirming payments automatically (bank API or statement import)
- A structured creditor reference (ISO 11649 `RF…`)
- A printable paper Zahlschein or PDF
- Payment providers (PayPal, card)

### Decisions

1. **One QR code per job**, not one for everything a member owes. Each transfer
   matches one paid flag. A combined code remains possible later.
2. **Reference** `RTC-<code> <name>`, because of the 35-character cap above. To be
   confirmed with the club treasurer.
3. **No "I've paid" button.** The bank statement is the source of truth either way.
4. **Only after the job is done**, because the price isn't fixed until completion
   (§5a).

## 17. Imprint, privacy notice, build version

The site is public, so it needs an Impressum and a privacy notice. Both are public
routes (`/imprint`, `/privacy`), linked from a footer on every page, signed in or not.

- **One source of facts.** `src/lib/legal.ts` holds the club's details (address, ZVR
  number, representative, contact, purpose, hosting provider, access-log retention).
  A field that is still `null` renders as a red "fehlt: …" marker instead of a gap,
  so an incomplete page can't go unnoticed.
- **Text.** Written out in `src/components/legal.tsx` rather than as message keys:
  legal prose is reviewed as a whole. German is binding; the English page says it is
  a courtesy translation.
- **What the notice claims** is what the app does: one strictly necessary session
  cookie, sessions with IP and user agent, in-memory sign-in rate limiting, the
  audit log, training data entered by coaches, no third parties at runtime
  (fonts are self-hosted, §14). Change the notice whenever any of that changes, and
  bump `privacyUpdated`.
- **Build version.** `vite.config.ts` bakes the commit hash (`git rev-parse HEAD`,
  `-dirty` with uncommitted changes, or `BUILD_COMMIT` outside a checkout) and the
  build time into the bundle. `/admin/strings` shows the short hash at the bottom.
