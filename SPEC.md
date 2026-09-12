# RTC Restringing App — Spec (v1.0, built)

Racket restringing requests for a local tennis club. Members register rackets and
request a restring; operators (members who string) work the queue and mark jobs done.
New accounts are unusable until an admin approves them.

## 1. Stack (already scaffolded)

| Concern   | Choice                                                                             |
| --------- | ---------------------------------------------------------------------------------- |
| Framework | TanStack Start (file routes in `src/routes`, `createServerFn` for mutations/loads) |
| DB        | Prisma 7 + SQLite (`@prisma/adapter-better-sqlite3`)                               |
| Auth      | better-auth 1.7 — `admin` plugin, `prismaAdapter`; email + password                |
| UI        | Tailwind 4 + shadcn/ui (new-york, zinc), lucide icons                              |
| Forms     | TanStack Form + Zod schemas shared client/server                                   |
| i18n      | Paraglide (`de` base, `en`) — all user-facing strings via messages                 |

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
   Rejecting sets `status = REJECTED` (kept for audit, cannot sign in).

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

Deleting a racket that has requests is blocked → archive instead, so history stays intact.
Same for a `ClubString` that has been used: deactivate (`active = false`) rather than delete,
so past jobs keep showing what was strung.

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
  admins can cancel any.
- `accept` claims the job for that operator; an operator can release back to `REQUESTED`.
- `complete` requires the actually used string + tension and a price (all prefilled —
  string and tension from the request, price from `ClubString.priceCents`; the operator
  can correct any of them, e.g. when they had to substitute a string).
- `collect` can be triggered by the operator (handed over) or the member (picked up).
- Every transition writes a `RequestEvent`.

## 6. Routes

| Route                                         | Access                  | Purpose                                                                                 |
| --------------------------------------------- | ----------------------- | --------------------------------------------------------------------------------------- |
| `/`                                           | public                  | Landing → redirects to `/dashboard` when signed in                                      |
| `/login`                                      | public                  | email + password                                                                        |
| `/signup`                                     | public, needs `?token=` | invite-gated — see §9                                                                   |
| `/pending`                                    | authed, PENDING         | "waiting for approval"                                                                  |
| `/dashboard`                                  | member                  | my open requests + quick "new request"                                                  |
| `/rackets`, `/rackets/new`, `/rackets/$id`    | member                  | manage own rackets                                                                      |
| `/requests`, `/requests/new`, `/requests/$id` | member                  | own requests + detail/timeline                                                          |
| `/queue`                                      | operator                | open + own claimed jobs, filter by status, sortable/searchable table                    |
| `/queue/$id`                                  | operator                | accept / complete / collect                                                             |
| `/billing`                                    | operator OR controller  | every restrung racket: string/labour/total price, paid state, sortable/searchable table |
| `/billing/payouts`                            | controller              | labour earned/reimbursed/outstanding per stringer, reimbursement ledger                 |
| `/invites`                                    | operator OR admin       | create/list/revoke invite links — see §9                                                |
| `/training`                                   | coach                   | redirects to the roster                                                                 |
| `/training/people`, `/training/people/$id`    | coach                   | trainee/trainer roster + weekly availability                                            |
| `/training/plans`, `/training/plans/$id`      | coach                   | solver knobs, saved runs, groups and who was left out                                   |
| `/admin/members`                              | admin                   | approve, reject, set roles                                                              |
| `/admin/strings`                              | admin                   | club string catalogue: add, edit price, deactivate                                      |
| `/api/auth/$`                                 | public                  | better-auth handler (exists)                                                            |

Guards live in one place: `beforeLoad` on a `_authed` pathless layout route that loads
the session, checks `status === APPROVED`, and a `requireRole()` helper for
`/queue` and `/admin`. `/billing` uses `requireAnyRole()` instead, since operator
and controller are independent specialties rather than one ranked above the other.
Every server function re-checks — the route guard is UX, the server function is
the security boundary.

## 7. Out of scope for v1

Push/email notifications, actual payment/settlement (a price is recorded per job, nothing
more), stock levels for club strings, photos of rackets, statistics/exports, password reset
by email, tracking physical drop-off/handover of the racket, multi-club/tenant support.

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
| Price           | Tracked per job (`priceCents`), prefilled from the catalogue                                                           |
| Racket handover | Not tracked in the app                                                                                                 |
| Signup access   | Invite-link only, single-use, expiry configurable (default 24h) — custom, not better-auth's `organization` invitations |

## 11. What is built

All of it. `pnpm test:e2e` drives the real HTTP stack (better-auth + the server
function RPC endpoints) and covers the approval gate, ownership isolation,
role enforcement, the full request lifecycle, and rejection revoking access.

| Area                  | Files                                                                                   |
| --------------------- | --------------------------------------------------------------------------------------- |
| Auth config           | `src/lib/auth.ts`, `src/lib/auth-client.ts`                                             |
| Session (server-only) | `src/lib/auth.server.ts` — split out so Prisma never reaches the client bundle          |
| Server fn guards      | `src/lib/auth-middleware.ts` (`member` / `operator` / `admin`)                          |
| Route guards          | `src/lib/guards.ts`, `src/routes/_authed.tsx`, `_authed/queue.tsx`, `_authed/admin.tsx` |
| Domain rules          | `src/lib/status.ts` (state machine), `src/lib/schemas.ts` (Zod)                         |
| Server functions      | `src/server/*.functions.ts`                                                             |
| Screens               | `src/routes/**`                                                                         |
| i18n                  | `messages/{en,de}.json`, `src/lib/labels.ts`                                            |

## 12. Known gaps

- No automated unit tests; `scripts/e2e-flow.ts` is the safety net and needs a
  running dev server.
- Cancel takes an optional reason server-side, but the UI does not ask for one.
- An operator who substitutes a different string just overwrites `usedStringName`;
  the member finds out on the detail page rather than being asked first.
- `fetchSession` runs on every navigation. Correct and always fresh, but it is one
  RPC per navigation — worth caching if the club ever outgrows it.

## 13. Training planner (spike)

A second, largely independent section: plan weekly group training and assign
trainees to trainers. Coaches only (§2); admins inherit the role.

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

- **Timetable** (`src/components/availability-grid.tsx`) — a Mon–Sun × 08:00–22:00 grid
  of half-hour cells. Drag to paint, drag over filled cells to erase; the cell the
  stroke starts on decides which, so one gesture never flip-flops. It saves once per
  stroke via `setAvailability`, which replaces the person's whole week — the grid always
  knows the complete picture, so a diff would just be a slower route to the same state.
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
overwriting the other. Plans are immutable: re-solving writes a new one.
