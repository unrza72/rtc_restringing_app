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
  priceCents: 2200,
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
  { priceCents?: number; usedStringName?: string } | undefined
check(
  'price and used string were stored',
  priced?.priceCents === 2200 &&
    priced.usedStringName === 'Babolat RPM Blast 1.25',
  priced,
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
