# RTC Restringing

Racket restringing requests for the tennis club. Members register their rackets and
request a restring; operators work the queue and mark jobs done. New accounts stay
locked until an admin approves them.

See [SPEC.md](SPEC.md) for the data model, status machine and design decisions.

## First run

```bash
pnpm install
pnpm db:generate      # generate the Prisma client
pnpm db:push          # create dev.db from prisma/schema.prisma
pnpm db:seed          # bootstrap the admin + a starter string catalogue
pnpm dev              # http://localhost:3000
```

The seed creates `admin@rtc.local` / `changeme123` — **change that password**, or
set `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, `SEED_ADMIN_NAME` before seeding.
Members sign in with their email address; there are no usernames. Without this admin nobody can ever approve the first member.

Environment lives in `.env`: `DATABASE_URL`, `BETTER_AUTH_URL`,
`BETTER_AUTH_SECRET`.

## Spike devtools: quick sign-in

`DEV_QUICK_LOGIN_ENABLED=true` (plus, optionally, `DEV_QUICK_LOGIN_PASSWORD`)
seeds six fixed accounts — 1 admin, 2 stringers, 3 members — and adds a
"Quick sign in" section to `/login` with one button per account, so you can
switch roles while testing without remembering six passwords.

```bash
# .env
DEV_QUICK_LOGIN_ENABLED=true
DEV_QUICK_LOGIN_PASSWORD=devpassword123   # optional, this is the default
```

Then reseed so the accounts actually exist:

```bash
pnpm db:seed
```

Both halves of the flag are checked independently — the seed only creates the
roster when the flag is set, and `devQuickSignIn` re-checks it on every call
rather than trusting that the buttons were hidden. Leave the flag unset (the
default) anywhere real: it hands out working sessions for six accounts with a
fixed, published password to anyone who can reach the login page.

## Roles

`member` (own rackets and requests) → `operator` (also works the queue) →
`admin` (also approves members and edits the string catalogue). Roles are
cumulative and stored comma-separated on the better-auth user; admins assign them
at `/admin/members`.

## Checks

```bash
pnpm exec tsc --noEmit   # types
pnpm lint                # eslint
pnpm build               # production build
pnpm test:e2e            # end-to-end flow — needs `pnpm dev` running
pnpm db:reset-data       # wipe app data after an e2e run, then re-seed
```

`scripts/e2e-flow.ts` drives the real HTTP stack: better-auth sign-in/sign-up plus
the server-function RPC endpoints. It covers the approval gate, ownership
isolation, role enforcement, the whole request lifecycle and the double-accept
race. It writes throwaway members and requests into `dev.db`, so follow it with
`pnpm db:reset-data && pnpm db:seed`.

## Two things worth knowing

**Auth is enforced on the server functions, not the routes.** Route `beforeLoad`
guards (`src/lib/guards.ts`) only keep people out of screens that would break for
them. Server functions are reachable as plain RPC endpoints, so every one that
touches private data runs through the middleware in `src/lib/auth-middleware.ts`.
Add a new server function → give it a middleware.

**better-auth owns four tables.** After changing `src/lib/auth.ts`, re-derive the
User/Session/Account/Verification fields and re-apply the app relations in
`prisma/schema.prisma` by hand. The `@better-auth/cli` version lags the library —
generating with a mismatched CLI silently omits columns (this is how
`Account.issuer`, required since 1.7, went missing the first time).

---

Welcome to your new TanStack Start app!

# Getting Started

To run this application:

```bash
pnpm install
pnpm dev
```

# Building For Production

To build this application for production:

```bash
pnpm build
```

## Styling

This project uses [Tailwind CSS](https://tailwindcss.com/) for styling.

### Removing Tailwind CSS

If you prefer not to use Tailwind CSS:

1. Remove the demo pages in `src/routes/demo/`
2. Replace the Tailwind import in `src/styles.css` with your own styles
3. Remove `tailwindcss()` from the plugins array in `vite.config.ts`
4. Remove `@tailwindcss/vite` and `tailwindcss` from `package.json`

## Linting & Formatting

This project uses [eslint](https://eslint.org/) and [prettier](https://prettier.io/) for linting and formatting. Eslint is configured using [tanstack/eslint-config](https://tanstack.com/config/latest/docs/eslint). The following scripts are available:

```bash
pnpm lint
pnpm format
pnpm check
```

## Deploy with Nitro

This project uses Nitro as a generic server adapter, so it can run on any Node-compatible host.

```bash
npm run build
node dist/server/index.mjs
```

The build output is a self-contained Node server. To deploy, push the `dist/` directory to your host (Render, Fly.io, your own VPS, etc.) and run the server command above.

For host-specific presets (Vercel, Netlify, Cloudflare, AWS Lambda, etc.) and tuning, see https://v3.nitro.build/deploy.

# Paraglide i18n

This add-on wires up ParaglideJS for localized routing and message formatting.

- Messages live in `project.inlang/messages`.
- URLs are localized through the Paraglide Vite plugin and router `rewrite` hooks.
- Run the dev server or build to regenerate the `src/paraglide` outputs.

## Setting up Better Auth

1. Generate and set the `BETTER_AUTH_SECRET` environment variable in your `.env`:

   ```bash
   pnpm dlx @better-auth/cli secret
   ```

2. Visit the [Better Auth documentation](https://www.better-auth.com) to unlock the full potential of authentication in your app.

### Adding a Database (Optional)

Better Auth can work in stateless mode, but to persist user data, add a database:

```typescript
// src/lib/auth.ts
import { betterAuth } from 'better-auth'
import { Pool } from 'pg'

export const auth = betterAuth({
  database: new Pool({
    connectionString: process.env.DATABASE_URL,
  }),
  // ... rest of config
})
```

Then run migrations:

```bash
pnpm dlx @better-auth/cli migrate
```

## Shadcn

Add components using the latest version of [Shadcn](https://ui.shadcn.com/).

```bash
pnpm dlx shadcn@latest add button
```

## Routing

This project uses [TanStack Router](https://tanstack.com/router) with file-based routing. Routes are managed as files in `src/routes`.

### Adding A Route

To add a new route to your application just add a new file in the `./src/routes` directory.

TanStack will automatically generate the content of the route file for you.

Now that you have two routes you can use a `Link` component to navigate between them.

### Adding Links

To use SPA (Single Page Application) navigation you will need to import the `Link` component from `@tanstack/react-router`.

```tsx
import { Link } from '@tanstack/react-router'
```

Then anywhere in your JSX you can use it like so:

```tsx
<Link to="/about">About</Link>
```

This will create a link that will navigate to the `/about` route.

More information on the `Link` component can be found in the [Link documentation](https://tanstack.com/router/v1/docs/framework/react/api/router/linkComponent).

### Using A Layout

In the File Based Routing setup the layout is located in `src/routes/__root.tsx`. Anything you add to the root route will appear in all the routes. The route content will appear in the JSX where you render `{children}` in the `shellComponent`.

Here is an example layout that includes a header:

```tsx
import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'My App' },
    ],
  }),
  shellComponent: ({ children }) => (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <header>
          <nav>
            <Link to="/">Home</Link>
            <Link to="/about">About</Link>
          </nav>
        </header>
        {children}
        <Scripts />
      </body>
    </html>
  ),
})
```

More information on layouts can be found in the [Layouts documentation](https://tanstack.com/router/latest/docs/framework/react/guide/routing-concepts#layouts).

## Server Functions

TanStack Start provides server functions that allow you to write server-side code that seamlessly integrates with your client components.

```tsx
import { createServerFn } from '@tanstack/react-start'

const getServerTime = createServerFn({
  method: 'GET',
}).handler(async () => {
  return new Date().toISOString()
})

// Use in a component
function MyComponent() {
  const [time, setTime] = useState('')

  useEffect(() => {
    getServerTime().then(setTime)
  }, [])

  return <div>Server time: {time}</div>
}
```

## API Routes

You can create API routes by using the `server` property in your route definitions:

```tsx
import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'

export const Route = createFileRoute('/api/hello')({
  server: {
    handlers: {
      GET: () => json({ message: 'Hello, World!' }),
    },
  },
})
```

## Data Fetching

There are multiple ways to fetch data in your application. You can use TanStack Query to fetch data from a server. But you can also use the `loader` functionality built into TanStack Router to load the data for a route before it's rendered.

For example:

```tsx
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/people')({
  loader: async () => {
    const response = await fetch('https://swapi.dev/api/people')
    return response.json()
  },
  component: PeopleComponent,
})

function PeopleComponent() {
  const data = Route.useLoaderData()
  return (
    <ul>
      {data.results.map((person) => (
        <li key={person.name}>{person.name}</li>
      ))}
    </ul>
  )
}
```

Loaders simplify your data fetching logic dramatically. Check out more information in the [Loader documentation](https://tanstack.com/router/latest/docs/framework/react/guide/data-loading#loader-parameters).

# Learn More

You can learn more about all of the offerings from TanStack in the [TanStack documentation](https://tanstack.com).

For TanStack Start specific documentation, visit [TanStack Start](https://tanstack.com/start).
