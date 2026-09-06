/**
 * Drives the real HTTP stack: better-auth sign-in/sign-up plus the server
 * function RPC endpoints, exactly as the browser would.
 */
import { fromCrossJSON, toJSONAsync } from 'seroval'

// Follows the app's own configured origin — better-auth checks the Origin
// header against it, so a hardcoded port silently fails every request.
const BASE =
  process.env.E2E_BASE_URL ??
  process.env.BETTER_AUTH_URL ??
  'http://localhost:4000'

function fnId(file: string, exportName: string) {
  return Buffer.from(
    JSON.stringify({
      file: `${file}?tss-serverfn-split`,
      export: `${exportName}_createServerFn_handler`,
    }),
  ).toString('base64url')
}

class Session {
  cookies = new Map<string, string>()
  label: string
  constructor(label: string) {
    this.label = label
  }

  private header() {
    return [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ')
  }
  private absorb(res: Response) {
    for (const c of res.headers.getSetCookie()) {
      const pair = c.split(';')[0]
      const i = pair.indexOf('=')
      this.cookies.set(pair.slice(0, i), pair.slice(i + 1))
    }
  }

  async auth(path: string, body: unknown) {
    const res = await fetch(`${BASE}/api/auth/${path}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: this.header(),
        origin: BASE,
      },
      body: JSON.stringify(body),
    })
    this.absorb(res)
    const text = await res.text()
    return { status: res.status, body: text }
  }

  /** Calls a server function the way the client RPC does. */
  async call(
    file: string,
    name: string,
    data?: unknown,
    method: 'GET' | 'POST' = 'POST',
  ) {
    const id = fnId(file, name)
    let url = `${BASE}/_serverFn/${id}`
    const headers: Record<string, string> = {
      cookie: this.header(),
      'x-tsr-serverFn': 'true',
      accept: 'application/json',
      origin: BASE,
      referer: `${BASE}/`,
    }
    let bodyInit: string | undefined
    const payload =
      data === undefined
        ? undefined
        : JSON.stringify(await toJSONAsync({ data }))

    if (method === 'GET') {
      if (payload) url += `?payload=${encodeURIComponent(payload)}`
    } else if (payload) {
      bodyInit = payload
      headers['content-type'] = 'application/json'
    }

    const res = await fetch(url, { method, headers, body: bodyInit })
    this.absorb(res)
    const text = await res.text()

    // Server functions answer 200 even when the handler threw; the envelope
    // carries { result, error }, so that is what decides success here.
    let result: unknown
    let error: string | null = null
    try {
      const env: { result?: unknown; error?: { message?: string } } =
        fromCrossJSON(JSON.parse(text), { refs: new Map() })
      result = env.result
      error = env.error ? (env.error.message ?? 'error') : null
    } catch {
      // Thrown Errors come back wrapped in a TanStack seroval plugin type that
      // the plain decoder cannot read; the message is still recoverable.
      const m = text.match(/"message":\{"t":1,"s":"((?:[^"\\]|\\.)*)"/)
      error = m
        ? JSON.parse(`"${m[1]}"`)
        : `undecodable response (${res.status}): ${text.slice(0, 120)}`
    }
    return { status: res.status, ok: error === null, result, error, raw: text }
  }
}

const RACKETS = '/src/server/rackets.functions.ts'
const REQUESTS = '/src/server/requests.functions.ts'
const STRINGS = '/src/server/strings.functions.ts'
const MEMBERS = '/src/server/members.functions.ts'
const PAYOUTS = '/src/server/payouts.functions.ts'

let failures = 0
function check(name: string, ok: boolean, detail?: unknown) {
  console.log(`${ok ? '  ✓' : '  ✗'} ${name}`)
  if (!ok) {
    failures++
    if (detail !== undefined)
      console.log('      ', JSON.stringify(detail).slice(0, 400))
  }
}

const admin = new Session('admin')
const member = new Session('member')

console.log('\n— auth —')
const signIn = await admin.auth('sign-in/email', {
  email: 'admin@rtc.local',
  password: 'changeme123',
})
check('admin signs in', signIn.status === 200, signIn.body)

const uniq = Date.now().toString().slice(-6)
const memberEmail = `player${uniq}@example.com`
const signUp = await member.auth('sign-up/email', {
  name: 'Test Player',
  email: memberEmail,
  password: 'password1234',
})
check('new member signs up', signUp.status === 200, signUp.body)

console.log('\n— approval gate —')
const blocked = await member.call(
  RACKETS,
  'listRackets',
  { includeArchived: false },
  'GET',
)
check(
  'unapproved member is refused',
  !blocked.ok && /approval/i.test(blocked.error ?? ''),
  blocked.error,
)

const memberList = await admin.call(MEMBERS, 'listMembers', undefined, 'GET')
check('admin lists members', memberList.ok, memberList.error)

type MemberRow = { id: string; email: string; status: string | null }
const rows = (memberList.result ?? []) as Array<MemberRow>
const target = rows.find((r) => r.email === memberEmail)
check('new member is listed as PENDING', target?.status === 'PENDING', target)

console.log('\n— admin approves —')
const approve = await admin.call(MEMBERS, 'decideMember', {
  userId: target!.id,
  status: 'APPROVED',
})
check('admin approves the member', approve.ok, approve.error)

const allowed = await member.call(
  RACKETS,
  'listRackets',
  { includeArchived: false },
  'GET',
)
check('approved member may now list rackets', allowed.ok, allowed.error)

console.log('\n— rackets —')
const racket = await member.call(RACKETS, 'createRacket', {
  label: 'Blue Pure Drive',
  brand: 'Babolat',
  model: 'Pure Drive',
  headSizeCm2: 645,
  stringPattern: '16x19',
  gripSize: 'L2',
  notes: null,
})
check('member creates a racket', racket.ok, racket.error)
const racketId = (racket.result as { id: string } | undefined)?.id

const foreign = await admin.call(RACKETS, 'getRacket', { id: racketId }, 'GET')
check(
  "another member cannot open someone else's racket",
  !foreign.ok,
  foreign.result,
)

console.log('\n— club strings —')
const strings = await member.call(
  STRINGS,
  'listActiveStrings',
  undefined,
  'GET',
)
check('member reads the catalogue', strings.ok, strings.error)
const clubStringId = ((strings.result ?? []) as Array<{ id: string }>)[0]?.id
check('catalogue is seeded', !!clubStringId, strings.result)

const notAdmin = await member.call(STRINGS, 'createClubString', {
  name: 'Nope',
  gauge: null,
  priceCents: 100,
  active: true,
  sortOrder: 0,
})
check(
  'member cannot add to the catalogue',
  !notAdmin.ok && /admin/i.test(notAdmin.error ?? ''),
  notAdmin.error,
)

console.log('\n— request lifecycle —')
const req = await member.call(REQUESTS, 'createRequest', {
  racketId,
  stringSource: 'CLUB',
  clubStringId,
  ownStringName: null,
  tensionMain: 24,
  tensionCross: 23,
  neededBy: null,
  memberNotes: 'Slight top-spin setup',
})
check('member creates a request', req.ok, req.error)
const requestId = (req.result as { id: string } | undefined)?.id

const badTension = await member.call(REQUESTS, 'createRequest', {
  racketId,
  stringSource: 'CLUB',
  clubStringId,
  ownStringName: null,
  tensionMain: 99,
  tensionCross: null,
  neededBy: null,
  memberNotes: null,
})
check('an absurd tension is rejected', !badTension.ok, badTension.error)

const noStringNamed = await member.call(REQUESTS, 'createRequest', {
  racketId,
  stringSource: 'MEMBER',
  clubStringId: null,
  ownStringName: null,
  tensionMain: 24,
  tensionCross: null,
  neededBy: null,
  memberNotes: null,
})
check(
  'own-string request must name the string',
  !noStringNamed.ok,
  noStringNamed.error,
)

const memberAccept = await member.call(REQUESTS, 'acceptRequest', {
  id: requestId,
})
check(
  'a plain member cannot accept jobs',
  !memberAccept.ok && /operator/i.test(memberAccept.error ?? ''),
  memberAccept.error,
)

const accept = await admin.call(REQUESTS, 'acceptRequest', { id: requestId })
check(
  'operator accepts the job',
  accept.ok && (accept.result as { status: string }).status === 'ACCEPTED',
  accept.error ?? accept.result,
)

const doubleAccept = await admin.call(REQUESTS, 'acceptRequest', {
  id: requestId,
})
check(
  'the same job cannot be accepted twice',
  !doubleAccept.ok,
  doubleAccept.error,
)

const earlyCollect = await member.call(REQUESTS, 'collectRequest', {
  id: requestId,
})
check('cannot collect before it is done', !earlyCollect.ok, earlyCollect.error)

const complete = await admin.call(REQUESTS, 'completeRequest', {
  id: requestId,
  usedStringName: 'Babolat RPM Blast 1.25',
  usedTensionMain: 24,
  usedTensionCross: 23,
  stringPriceCents: 1200,
  labourPriceCents: 1000,
  operatorNotes: 'Strung on the Wise',
})
check(
  'operator completes the job',
  complete.ok && (complete.result as { status: string }).status === 'DONE',
  complete.error ?? complete.result,
)

const collect = await member.call(REQUESTS, 'collectRequest', { id: requestId })
check(
  'member confirms collection',
  collect.ok && (collect.result as { status: string }).status === 'COLLECTED',
  collect.error ?? collect.result,
)

const lateCancel = await member.call(REQUESTS, 'cancelRequest', {
  id: requestId,
})
check(
  'a collected job can no longer be cancelled',
  !lateCancel.ok,
  lateCancel.error,
)

const detail = await member.call(
  REQUESTS,
  'getRequest',
  { id: requestId },
  'GET',
)
const events = (
  (detail.result as { events?: Array<{ toStatus: string }> } | undefined)
    ?.events ?? []
).map((e) => e.toStatus)
check(
  'the timeline recorded every step',
  JSON.stringify(events) ===
    JSON.stringify(['REQUESTED', 'ACCEPTED', 'DONE', 'COLLECTED']),
  events,
)

const priced = detail.result as
  | {
      stringPriceCents?: number
      labourPriceCents?: number
      usedStringName?: string
      paidAt?: string | null
    }
  | undefined
check(
  'string price, labour price and used string were stored',
  priced?.stringPriceCents === 1200 &&
    priced.labourPriceCents === 1000 &&
    priced.usedStringName === 'Babolat RPM Blast 1.25',
  priced,
)
check('a freshly completed job starts unpaid', priced?.paidAt == null, priced)

console.log('\n— controller: the paid state —')

const memberBilling = await member.call(
  REQUESTS,
  'listBillableRequests',
  undefined,
  'GET',
)
check(
  'a plain member cannot open the billing view',
  !memberBilling.ok,
  memberBilling.error,
)

const billing = await admin.call(
  REQUESTS,
  'listBillableRequests',
  undefined,
  'GET',
)
const billingRow = ((billing.result ?? []) as Array<{ id: string }>).find(
  (r) => r.id === requestId,
)
check(
  'admin (implies operator) sees the job in the billing view',
  !!billingRow,
  billing.error ?? billing.result,
)

const memberSetPaid = await member.call(REQUESTS, 'setRequestPaid', {
  id: requestId,
  paid: true,
})
check(
  'a plain member cannot mark a job paid',
  !memberSetPaid.ok && /controller/i.test(memberSetPaid.error ?? ''),
  memberSetPaid.error,
)

// Admin implies controller, so this should work without ever granting the
// role explicitly — the same cascade the role hierarchy promises everywhere
// else in the app.
const markPaid = await admin.call(REQUESTS, 'setRequestPaid', {
  id: requestId,
  paid: true,
})
check('admin marks the job paid', markPaid.ok, markPaid.error)

const afterPaid = await member.call(
  REQUESTS,
  'getRequest',
  { id: requestId },
  'GET',
)
check(
  'paidAt is now set',
  !!(afterPaid.result as { paidAt?: string | null } | undefined)?.paidAt,
  afterPaid.result,
)

const resetPaid = await admin.call(REQUESTS, 'setRequestPaid', {
  id: requestId,
  paid: false,
})
check('admin resets the job back to unpaid', resetPaid.ok, resetPaid.error)

const afterReset = await member.call(
  REQUESTS,
  'getRequest',
  { id: requestId },
  'GET',
)
check(
  'paidAt is cleared again',
  (afterReset.result as { paidAt?: string | null } | undefined)?.paidAt == null,
  afterReset.result,
)

// A dedicated controller — not an admin, no operator role — should be able to
// toggle paid but nothing else admin-only.
const controllerEmail = `controller${uniq}@example.com`
const controller = new Session('controller')
await controller.auth('sign-up/email', {
  name: 'Test Controller',
  email: controllerEmail,
  password: 'password1234',
})
const list3 = await admin.call(MEMBERS, 'listMembers', undefined, 'GET')
const controllerRow = ((list3.result ?? []) as Array<MemberRow>).find(
  (r) => r.email === controllerEmail,
)
await admin.call(MEMBERS, 'decideMember', {
  userId: controllerRow!.id,
  status: 'APPROVED',
})
const grantControllerRole = await admin.call(MEMBERS, 'setMemberRoles', {
  userId: controllerRow!.id,
  roles: ['controller'],
})
check(
  'admin grants the controller role',
  grantControllerRole.ok,
  grantControllerRole.error,
)

const controllerViewsBilling = await controller.call(
  REQUESTS,
  'listBillableRequests',
  undefined,
  'GET',
)
check(
  'a controller (not an operator) can still open the billing view',
  controllerViewsBilling.ok,
  controllerViewsBilling.error,
)

const controllerMarksPaid = await controller.call(REQUESTS, 'setRequestPaid', {
  id: requestId,
  paid: true,
})
check(
  'a dedicated controller can mark a job paid',
  controllerMarksPaid.ok,
  controllerMarksPaid.error,
)

const controllerAsAdmin = await controller.call(
  MEMBERS,
  'listMembers',
  undefined,
  'GET',
)
check(
  'a controller is not also an admin',
  !controllerAsAdmin.ok,
  controllerAsAdmin.error,
)

console.log('\n— controller: the labour payout ledger —')

type Balance = {
  operatorId: string
  earnedCents: number
  reimbursedCents: number
  outstandingCents: number
}

const memberBalances = await member.call(
  PAYOUTS,
  'listLabourBalances',
  undefined,
  'GET',
)
check(
  'a plain member cannot see labour balances',
  !memberBalances.ok,
  memberBalances.error,
)

const adminId = ((list3.result ?? []) as Array<MemberRow>).find(
  (r) => r.email === 'admin@rtc.local',
)?.id

const balances = await controller.call(
  PAYOUTS,
  'listLabourBalances',
  undefined,
  'GET',
)
const adminBalance = ((balances.result ?? []) as Array<Balance>).find(
  (b) => b.operatorId === adminId,
)
check(
  'the admin stringer earned the labour price of the completed job',
  adminBalance?.earnedCents === 1000 && adminBalance.outstandingCents === 1000,
  { balances: balances.result, adminBalance },
)

const overReimburse = await controller.call(PAYOUTS, 'recordReimbursement', {
  operatorId: adminBalance?.operatorId,
  amountCents: 100000,
})
check(
  'cannot reimburse more than the outstanding balance',
  !overReimburse.ok,
  overReimburse.error,
)

const memberReimburse = await member.call(PAYOUTS, 'recordReimbursement', {
  operatorId: adminBalance?.operatorId,
  amountCents: 500,
})
check(
  'a plain member cannot record a reimbursement',
  !memberReimburse.ok,
  memberReimburse.error,
)

const reimburse = await controller.call(PAYOUTS, 'recordReimbursement', {
  operatorId: adminBalance?.operatorId,
  amountCents: 500,
  note: 'Partial payout',
})
check('controller records a reimbursement', reimburse.ok, reimburse.error)

const balancesAfter = await controller.call(
  PAYOUTS,
  'listLabourBalances',
  undefined,
  'GET',
)
const adminBalanceAfter = ((balancesAfter.result ?? []) as Array<Balance>).find(
  (b) => b.operatorId === adminBalance?.operatorId,
)
check(
  'the outstanding balance dropped by the reimbursed amount',
  adminBalanceAfter?.reimbursedCents === 500 &&
    adminBalanceAfter.outstandingCents === 500,
  adminBalanceAfter,
)

const history = await controller.call(
  PAYOUTS,
  'listReimbursements',
  undefined,
  'GET',
)
type Ledger = {
  amountCents: number
  note: string | null
  operator: { name: string }
}
const historyEntry = ((history.result ?? []) as Array<Ledger>).find(
  (e) => e.amountCents === 500,
)
check(
  'the reimbursement was logged with its note and stringer name',
  historyEntry?.note === 'Partial payout' &&
    historyEntry.operator.name === 'Club Admin',
  history.result,
)

console.log('\n— rejection revokes access —')
const rejectEmail = `reject${uniq}@example.com`
const rejected = new Session('rejected')
await rejected.auth('sign-up/email', {
  name: 'Rejected Player',
  email: rejectEmail,
  password: 'password1234',
})
const list2 = await admin.call(MEMBERS, 'listMembers', undefined, 'GET')
const rejectRow = ((list2.result ?? []) as Array<MemberRow>).find(
  (r) => r.email === rejectEmail,
)
const doReject = await admin.call(MEMBERS, 'decideMember', {
  userId: rejectRow!.id,
  status: 'REJECTED',
})
check('admin rejects a member', doReject.ok, doReject.error)
const afterReject = await rejected.call(
  RACKETS,
  'listRackets',
  { includeArchived: false },
  'GET',
)
check('a rejected member is signed out', !afterReject.ok, afterReject.error)

console.log(
  `\n${failures === 0 ? '✅ all checks passed' : `❌ ${failures} check(s) failed`}\n`,
)
process.exit(failures === 0 ? 0 : 1)
