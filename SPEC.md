# RTC Restringing App — Spec (v1.1, built)

Racket restringing requests for a local tennis club. Members register rackets and
request a restring; operators (members who string) work the queue and mark jobs done.
New accounts are unusable until an admin approves them.

Since v1.0 the app has grown a billing/payout side (§2, §4), invite-gated signup (§9),
a training planner (§13), a light theme (§14) and developer tooling (§15). **What the
spec promises but the code does not yet do is collected in §12** — start there.

## 1. Stack (already scaffolded)

| Concern   | Choice                                                                             |
| --------- | ---------------------------------------------------------------------------------- |
| Framework | TanStack Start (file routes in `src/routes`, `createServerFn` for mutations/loads) |
| DB        | Prisma 7 + SQLite (`@prisma/adapter-better-sqlite3`)                               |
| Auth      | better-auth 1.7 — `admin` plugin, `prismaAdapter`; email + password                |
| UI        | Tailwind 4 + shadcn/ui (new-york, zinc), lucide icons; light theme, see §14        |
| Forms     | TanStack Form + Zod schemas shared client/server                                   |
| i18n      | Paraglide (`de` base, `en`) — all user-facing strings via messages                 |
| Tests     | HTTP-level e2e script plus two pure unit-check scripts — see §11                   |

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
5. Admins cannot change their own approval status or drop their own admin role, and
   the last approved admin cannot be demoted — the club always keeps one.

The first user created by the seed script is `admin` + `APPROVED` (bootstrap) —
seeding bypasses better-auth (and so the invite gate) entirely; see §9.

## 4. Data model

```prisma
// better-auth managed: User, Session, Account, Verification
// NOTE: 1.7 scopes account identity by `issuer` — Account.issuer is required
// ("local:credential" for password logins). The CLI lags the library, so
// regenerate field lists from the installed package, not `@better-auth/cli`.
// User extended with:
//   role         String   @default("member")   (admin plugin)
//   banned, banReason, banExpires             (admin plugin)
//   status       String   @default("PENDING")  // PENDING | APPROVED | REJECTED
//   approvedAt   DateTime?
//   approvedById String?
//   locale       String?  // "en" | "de" — see §8, Locale routing
//   inviteToken  String?  // the invite this account was created with — see §9

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
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  requests      StringingRequest[]
}

model ClubString {
  id         String   @id @default(cuid())
  name       String   // "Luxilon ALU Power"
  gauge      String?  // "1.25"
  priceCents Int?     // what the club charges for it
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
  neededBy      DateTime?
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
  stringPriceCents Int?  // materials, prefilled from ClubString.priceCents
  labourPriceCents Int?  // the stringing fee, entered by the operator

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

Deleting a racket that has requests is blocked → archive instead, so history stays intact.
Archiving is in turn blocked while the racket still has an open request. Same for a
`ClubString` that has been used: "remove" deactivates it (`active = false`) rather than
deleting, so past jobs keep showing what was strung; an unused one is deleted outright.

**String selection invariant** (enforced in the Zod schema and re-checked server-side):
`stringSource = CLUB` → `clubStringId` set, `ownStringName` null;
`stringSource = MEMBER` → `ownStringName` set, `clubStringId` null.

## 5. Status machine

```
REQUESTED --accept(operator)--> ACCEPTED --complete(operator)--> DONE --collect--> COLLECTED
    |                               |
    +-------- cancel(owner/admin) --+--> CANCELLED
```

- Only `REQUESTED` and `ACCEPTED` can be cancelled; the owner can cancel their own,
  admins can cancel any. **The admin half is server-side only** — no screen offers
  the button to anyone but the owner (§12).
- Cancelling asks for confirmation in a dialog. The server accepts an optional reason
  (stored as the event's `note`); the dialog does not ask for one yet (§12).
- `accept` claims the job for that operator; an operator can release back to `REQUESTED`.
  Release and complete are limited to the claiming operator — admins may act on any job.
- `complete` requires the actually used string and main tension (both prefilled from the
  request; the operator can correct them, e.g. when they had to substitute a string).
  String and labour price are prefilled — string price from `ClubString.priceCents` —
  but **optional**: v1.0 said "requires a price", the code accepts none (§12).
- `collect` can be triggered by the operator (handed over) or the member (picked up).
- Every transition writes a `RequestEvent`. The current status is part of the update's
  `where` clause, so two operators racing for one job resolve to exactly one winner;
  the loser gets a localized "someone else changed this request" error.
- Paid state (§2, controller) is deliberately **not** a transition: it is set/reset on
  `DONE` or `COLLECTED` jobs only, and never moves the status.

## 6. Routes

| Route                                         | Access                    | Purpose                                                                                            |
| --------------------------------------------- | ------------------------- | -------------------------------------------------------------------------------------------------- |
| `/`                                           | public                    | Landing → redirects to `/dashboard` when signed in                                                 |
| `/login`                                      | public                    | email + password                                                                                   |
| `/signup`                                     | public, needs `?token=`   | invite-gated — see §9                                                                              |
| `/pending`                                    | authed, PENDING           | "waiting for approval"                                                                             |
| `/dashboard`                                  | member                    | my open requests + quick "new request"; operator (jobs waiting) and admin (pending members) panels |
| `/rackets`, `/rackets/new`, `/rackets/$id`    | member                    | manage own rackets                                                                                 |
| `/requests`, `/requests/new`, `/requests/$id` | member                    | own requests + detail/timeline                                                                     |
| `/queue`                                      | operator                  | open + own claimed jobs, filter by status, sortable/searchable table                               |
| `/queue/$id`                                  | operator                  | accept / complete / collect                                                                        |
| `/billing`                                    | operator OR controller    | every restrung racket: string/labour/total price, paid state, sortable/searchable table            |
| `/billing/payouts`                            | controller                | labour earned/reimbursed/outstanding per stringer, reimbursement ledger                            |
| `/invites`                                    | operator (admin inherits) | create/list/revoke invite links — see §9                                                           |
| `/training`                                   | coach                     | redirects to the roster                                                                            |
| `/training/people`, `/training/people/$id`    | coach                     | trainee/trainer roster + weekly availability                                                       |
| `/training/plans`, `/training/plans/$id`      | coach                     | solver knobs, saved runs, groups and who was left out                                              |
| `/admin/members`                              | admin                     | approve, reject, set roles                                                                         |
| `/admin/strings`                              | admin                     | club string catalogue: add, edit price, deactivate                                                 |
| `/api/auth/$`                                 | public                    | better-auth handler (exists)                                                                       |

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
| Price           | Tracked per job, split into `stringPriceCents` (prefilled from the catalogue) and `labourPriceCents`; both optional    |
| Payment         | A paid flag per job (controller), plus an append-only labour payout ledger per stringer — no real settlement           |
| Light theme     | Committed light-only palette; no dark mode or user toggle                                                              |
| Racket handover | Not tracked in the app                                                                                                 |
| Signup access   | Invite-link only, single-use, expiry configurable (default 24h) — custom, not better-auth's `organization` invitations |

## 11. What is built

Everything in §2–§10, §13 and §14, except the items listed in §12. All feature and
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

### Tests

None of these run in CI — there is no CI configuration in the repo.

| Command               | What it covers                                                                                                                                                                                                                                     |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm test:e2e`       | Real HTTP stack (better-auth + server-function RPC) against a **running dev server**: auth, invite gate, approval, rackets, strings, request lifecycle, paid state, payout ledger, locale persistence, training planner, rejection revoking access |
| `pnpm test:solver`    | The grouping solver in isolation — hard rules, determinism, unplaced reasons                                                                                                                                                                       |
| `pnpm test:timetable` | Timetable cell⇄slot conversion, configurable window, out-of-window preservation, lane packing                                                                                                                                                      |

The e2e script mutates the dev database; run `pnpm db:reset-data && pnpm db:seed`
before a second run, or balance assertions in the payout section fail on leftovers.

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
| `complete` requires a price (§5)      | String and labour price are **optional**                                                                  | `schemas.ts` `completeInputSchema`    |

### Not built yet

- **Cancel reason.** The server stores an optional reason on the cancel event; the
  dialog does not ask for one.
- **Substitute-string consent.** An operator who uses a different string just
  overwrites `usedStringName`; the member finds out on the detail page rather than
  being asked first.
- **Invite revocation still uses the browser's native `confirm()`** (`invites.tsx`),
  unlike cancel, which moved to a localized Radix dialog.
- **Dashboard panels for controllers and coaches.** Operators and admins get a panel;
  the other two roles get only their own requests.
- **CI.** All three test scripts are manual; e2e additionally needs a running server.
- **Seed is not deployment-safe.** `pnpm db:seed` always inserts a demo training roster
  (trainers and trainees with availability), not only when dev quick-login is enabled
  like the other demo data. Running it on a real club database adds fake people to the
  planner.
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

Built as a spike, now merged into `main` — it replaced the prototype's dark workshop
look. A bright, near-white surface with the tennis-ball lime kept as the one loud
accent. The palette lives in `src/styles.css`:

- **Tokens over utilities.** Components reach for `bg-card`, `text-muted-foreground`,
  `border-border` rather than raw `slate-*`, so the next change of mind is a change to
  the `:root` block alone. The one deliberate exception is a saturated fill that carries
  its own text, such as the amber "active filter" tab.
- **Fill vs ink.** `--primary` is lime-500, which reads well as a button fill under
  near-black text (10.2:1) but is nearly invisible _as_ a mark on white (2.0:1). Anything
  drawn thin — a link, a radio dot, a slider edge — uses `--primary-ink` (lime-700,
  5.0:1) instead. Reaching for `text-primary` on a light surface is almost always wrong.
- **Depth from shadow.** A dark theme separates surfaces by making them lighter; a light
  one cannot, so cards carry a soft two-stage shadow instead.
- **Badges are tints, not fills.** Status and ball badges pair a pale background with
  saturated text. Solid colour blocks shout far louder than a status deserves on white.
- **Base size** is 104.2% (16.67px), half a point above the browser default, as a
  percentage so a reader who has already raised their own base size keeps the increase.

Every foreground/background pair in the palette clears WCAG AA (4.5:1 for text, 3:1 for
UI marks); the tightest are muted text at 4.55:1 and the collected-status badge at 4.55:1.

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

| Command              | What it does                                                                                                                                                       |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm db:seed`       | Idempotent. Bootstrap admin, club string catalogue and a demo training roster — always. The dev roster and demo rackets/requests only with dev quick-login enabled |
| `pnpm db:reset-data` | Deletes every user, racket, request, invite, payout and training row; keeps the string catalogue. Follow with `pnpm db:seed`                                       |
| `pnpm test:*`        | See §11                                                                                                                                                            |

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
