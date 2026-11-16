# Deployment

The app runs as one Node process under [pm2](https://pm2.keymetrics.io/), with a
PostgreSQL database. Updating it takes one command
(`./scripts/deploy.sh`), and runs the same steps every time:

1. pull the latest `main` from GitHub
2. install packages with pnpm
3. generate the Prisma client
4. back up the database, then apply any new migrations
5. build
6. reload the pm2 process

Set up the server once (below), then use [Updating](#updating) for every
release after that.

## What the server needs

- **Node.js 22** or newer. pm2 starts the server with `node --env-file=.env`.
- **pnpm 12**: `npm install -g pnpm@12`, or `corepack enable`.
- **pm2**: `npm install -g pm2`.
- **PostgreSQL 16** (14 or newer works), on the same machine or reachable from
  it. The app connects with `@prisma/adapter-pg`; nothing else to install for
  Node.
- **`pg_dump` and `pg_restore`** for backups, at least the server's major
  version: `pg_dump --version` must not be older than the server, or the
  backup step stops the deploy. On Debian/Ubuntu: `apt install
postgresql-client-16` (or the server's version).
- **Read access to the GitHub repo**, for example a
  [deploy key](https://docs.github.com/en/authentication/connecting-to-github-with-ssh/managing-deploy-keys).
- **A reverse proxy with HTTPS** (nginx, Caddy, …) on the same machine that
  forwards the public domain to the app's port. Sign-in only works from the
  address set in `BETTER_AUTH_URL`. The proxy must also:
  - **pass on the visitor's address** in `X-Forwarded-For`. Sign-in and signup
    are rate-limited per visitor (5 sign-ins a minute, 10 signups per 10
    minutes), and the limiter finds the visitor there. Caddy does this by
    default. With nginx, add
    `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;`. Without
    it, all visitors share one limit, and the log warns that rate limiting
    "could not determine a client IP".
  - **send an HSTS header** (`Strict-Transport-Security: max-age=31536000`),
    so browsers never try the site over plain HTTP.
  - **not add other security headers.** The app sends its own
    Content-Security-Policy (with a fresh nonce on every page),
    `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`,
    `Permissions-Policy` and `Cross-Origin-Opener-Policy`. A second CSP from
    the proxy would apply on top and block the app's own scripts.

## First install

### 1. Clone the repo

```bash
git clone git@github.com:unrza72/rtc_restringing_app.git ~/rtc_restringing_app
cd ~/rtc_restringing_app
```

### 2. Create the database

As a PostgreSQL superuser (e.g. `sudo -u postgres psql`), create a login for
the app and a database it owns:

```sql
CREATE ROLE rtc LOGIN PASSWORD '<a long random password>';
CREATE DATABASE rtc_restringing OWNER rtc;
```

The app's user needs nothing more: it owns its database, so migrations can
create and change tables. It does not need `CREATEDB` or superuser rights.

Check that the login works:

```bash
psql "postgresql://rtc@localhost:5432/rtc_restringing" -c 'select 1'
```

### 3. Create `.env`

`.env` sits next to `package.json` and is never committed.

```bash
# .env
DATABASE_URL="postgresql://rtc:<password>@localhost:5432/rtc_restringing"
BETTER_AUTH_URL="https://<public domain>"                 # exactly as members type it
BETTER_AUTH_SECRET="<output of: openssl rand -base64 32>"
PORT=3000                                                 # what the reverse proxy forwards to
HOST=127.0.0.1                                            # only the proxy can reach the app (keep this: rate limiting trusts the proxy)

# Optional
RACKET_TOKENS_ENABLED=true   # members pick the numbered carabiner when they request a restring
```

In `DATABASE_URL`, percent-encode characters in the password that have a
meaning in a URL: `@` → `%40`, `:` → `%3A`, `/` → `%2F`, `#` → `%23`, `%` →
`%25`. Or pick a password of letters and digits only
(`openssl rand -hex 24`). For a database on another machine, add
`?sslmode=require`.

Never set `DEV_QUICK_LOGIN_ENABLED` here. It lets anyone sign in as six test
accounts that share a published password.

Changing `BETTER_AUTH_SECRET` later signs everyone out.

`BETTER_AUTH_URL` must start with `https://`. That turns on the hardened
session cookie (`__Host-rtc.session_token`: Secure, HttpOnly, SameSite=Lax, no
Domain). With an `http://` address the cookie falls back to the weaker
development settings.

### 4. Install, create the tables, build

```bash
pnpm install --frozen-lockfile
pnpm db:generate      # Prisma client (src/generated/ is not in git)
pnpm db:deploy        # creates the tables: applies every migration
pnpm build            # writes the server to .output/
```

### 5. Create the admin

Without an admin nobody can approve the first member, so create one:

```bash
pnpm admin:set admin@example.org --name "Club Admin"
```

It asks for the password twice and doesn't show it as you type, so it ends up
neither in `.env` nor in the shell history. Admin passwords need at least 12
characters.

Run the same command whenever an admin is locked out. For an existing account
it sets the new password, makes the account an admin and approved, and signs
it out everywhere (`--name` can be left off then). For a script, pipe the
password in instead: `pnpm admin:set admin@example.org < password-file`.

Don't run `pnpm db:seed` on the server. It is for development, and without
its `SEED_ADMIN_*` settings it creates `admin@rtc.local` with the published
password `changeme123`.

### 6. Start under pm2

```bash
pm2 start ecosystem.config.cjs
pm2 save              # remember the process list
pm2 startup           # prints a command to run once, so pm2 starts at boot
```

[ecosystem.config.cjs](ecosystem.config.cjs) runs `.output/server/index.mjs` as
`rtc-restringing`, reading its settings from `.env`.

Open `BETTER_AUTH_URL` in a browser and sign in as the admin. There is no open
signup: new members join through invite links created at `/invites`.

### Moving from the SQLite version

Until November 2026 the app stored its data in a SQLite file. The PostgreSQL
version starts its own migration history with a new `0_init`, so on a fresh
PostgreSQL database the steps above are complete.

**Data from an existing SQLite deployment is not carried over.** Copying
members, rackets, jobs and payouts across is not automated yet. Keep the SQLite
version running until it is, and don't point the new version at the old
`.env`: its `file:` URL no longer works.

## Updating

```bash
cd ~/rtc_restringing_app
./scripts/deploy.sh
```

[scripts/deploy.sh](scripts/deploy.sh) stops at the first step that fails, and
the running app keeps serving the old version until the final reload. Step by
step:

| Step                                       | What it does                                                                                                                         |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| `git pull --ff-only`                       | Gets the latest `main`. Refuses to merge if someone edited files on the server.                                                      |
| `pnpm install --frozen-lockfile`           | Installs exactly the versions in `pnpm-lock.yaml`. Dev dependencies are included, because the build needs them.                      |
| `pnpm db:generate`                         | Regenerates the Prisma client for the current schema.                                                                                |
| `pg_dump --format=custom`                  | Writes a consistent copy of the live database to `~/rtc-backups/rtc-<date>-<time>.dump`. Set `BACKUP_DIR` to back up somewhere else. |
| `pnpm db:deploy`                           | `prisma migrate deploy`: applies the new migrations in `prisma/migrations/`, in order. Does nothing when there are none.             |
| `pnpm build`                               | Builds the server into `.output/`.                                                                                                   |
| `pm2 startOrReload … --update-env`, `save` | Restarts `rtc-restringing` on the new build with the current `.env`, or starts it if it isn't running.                               |

Backups pile up in `~/rtc-backups`. Delete old ones now and then. They hold
every member's name and email, so keep the folder private
(`chmod 700 ~/rtc-backups`).

The script reads `DATABASE_URL` from `.env` and hands `pg_dump` the password
through `PGPASSWORD`, so it never shows up in the process list. A backup taken
by hand:

```bash
pg_dump --format=custom --file="$HOME/rtc-backups/manual.dump" \
  "postgresql://rtc@localhost:5432/rtc_restringing"   # asks for the password
```

Changed only `.env`? Then skip the deploy and run
`pm2 reload ecosystem.config.cjs --update-env`.

### Where migrations come from

Migrations are written during development, never on the server. After changing
`prisma/schema.prisma`, the developer runs `pnpm db:migrate --name <change>` and
commits the new folder in `prisma/migrations/`. Read its `migration.sql` before
committing: a new required column with no default fails on a table that
already has rows, and a dropped or renamed column loses its data unless the
migration copies it.

`pnpm db:migrate` (`prisma migrate dev`) needs a second, empty PostgreSQL
database it may wipe, the shadow database. It is never used on the server:
`pnpm db:deploy` doesn't need one. On a development machine, either give the
database user `CREATEDB` (`ALTER ROLE rtc CREATEDB;`), so Prisma creates and
drops the shadow database itself, or create one and name it in `.env`:

```sql
CREATE DATABASE rtc_restringing_shadow OWNER rtc;
```

```bash
# .env (development only)
SHADOW_DATABASE_URL="postgresql://rtc:<password>@localhost:5432/rtc_restringing_shadow"
```

Prisma refuses a shadow database inside the main database, even in another
schema.

## When something goes wrong

**Logs:** `pm2 logs rtc-restringing`. Status: `pm2 status`.

**The build or a migration failed.** The old version is still running, because
pm2 only reloads after everything else succeeded. A migration that fails
partway can leave the database half-changed. Restore the backup the script just
wrote (see below) before trying again.

**Rolling back a release.**

```bash
pm2 stop rtc-restringing
pg_restore --clean --if-exists --no-owner \
  --dbname="postgresql://rtc@localhost:5432/rtc_restringing" \
  ~/rtc-backups/rtc-<date>-<time>.dump                  # the backup from that deploy
git checkout <previous commit>
pnpm install --frozen-lockfile && pnpm db:generate && pnpm build
pm2 start ecosystem.config.cjs
```

Restoring the database loses anything members entered since that backup. When
the release didn't change the schema, roll back the code and leave the database
alone. Run `git checkout main` before the next deploy, because `git pull` doesn't
work on a detached checkout.

`--clean --if-exists` drops each table before restoring it, so the database
ends up exactly as it was at the backup, migration history included. Stop the
app first: open connections would hold locks and stall the restore.

**`Can't reach database server` / `P1001`.** PostgreSQL isn't running, or
`DATABASE_URL` has the wrong host or port. `pg_isready -h localhost -p 5432`
tells which.

**`password authentication failed` / `P1000`.** Wrong user or password in
`DATABASE_URL`, or a special character in the password that isn't
percent-encoded (see step 3).

**`pg_dump: error: aborting because of server version mismatch`.** The
`pg_dump` on the server is older than PostgreSQL itself. Install the client
for the server's version (`postgresql-client-<version>`).

**Sign-in fails or loops back to the login page.** `BETTER_AUTH_URL` doesn't
match the address in the browser (`http` vs `https`, `www.` or not). Fix
`.env`, then run `pm2 reload ecosystem.config.cjs --update-env`.
