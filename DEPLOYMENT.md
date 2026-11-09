# Deployment

The app runs as one Node process under [pm2](https://pm2.keymetrics.io/), with a
SQLite database file on the same server. Updating it takes one command
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
- **Read access to the GitHub repo**, for example a
  [deploy key](https://docs.github.com/en/authentication/connecting-to-github-with-ssh/managing-deploy-keys).
- **A reverse proxy with HTTPS** (nginx, Caddy, …) that forwards the public
  domain to the app's port. Sign-in only works from the address set in
  `BETTER_AUTH_URL`.

## First install

### 1. Clone the repo

```bash
git clone git@github.com:unrza72/rtc_restringing_app.git ~/rtc_restringing_app
cd ~/rtc_restringing_app
```

### 2. Create `.env`

`.env` sits next to `package.json` and is never committed. Keep the database
outside the checkout, so a fresh clone can never delete it:

```bash
mkdir -p ~/rtc-data
```

```bash
# .env
DATABASE_URL="file:///home/<user>/rtc-data/rtc.sqlite"   # absolute path
BETTER_AUTH_URL="https://<public domain>"                 # exactly as members type it
BETTER_AUTH_SECRET="<output of: openssl rand -base64 32>"
PORT=3000                                                 # what the reverse proxy forwards to
HOST=127.0.0.1                                            # only the proxy can reach the app

# Optional
RACKET_TOKENS_ENABLED=true   # members pick the numbered carabiner when they request a restring

# Only for the first `pnpm db:seed`: the bootstrap admin
SEED_ADMIN_NAME="…"
SEED_ADMIN_EMAIL="…"
SEED_ADMIN_PASSWORD="…"
```

Never set `DEV_QUICK_LOGIN_ENABLED` here. It lets anyone sign in as six test
accounts that share a published password.

Changing `BETTER_AUTH_SECRET` later signs everyone out.

### 3. Install, create the database, build

```bash
pnpm install --frozen-lockfile
pnpm db:generate      # Prisma client (src/generated/ is not in git)
pnpm db:deploy        # creates the database and applies every migration
pnpm db:seed          # creates the bootstrap admin from SEED_ADMIN_*
pnpm build            # writes the server to .output/
```

The seed leaves an existing admin alone, so running it twice does no harm.
After the first sign-in, you can remove the `SEED_ADMIN_*` lines from `.env`.

### 4. Start under pm2

```bash
pm2 start ecosystem.config.cjs
pm2 save              # remember the process list
pm2 startup           # prints a command to run once, so pm2 starts at boot
```

[ecosystem.config.cjs](ecosystem.config.cjs) runs `.output/server/index.mjs` as
`rtc-restringing`, reading its settings from `.env`.

Open `BETTER_AUTH_URL` in a browser and sign in as the admin. There is no open
signup: new members join through invite links created at `/invites`.

### Already running on a server deployed before migrations

Earlier deployments built the database with `prisma db push`. Since then the
schema lives in `prisma/migrations/`, starting with `0_init`, which describes
the whole schema as it was when migrations began. Do this once, before your
first run of `./scripts/deploy.sh`.

1. Back up the database:

   ```bash
   echo "VACUUM INTO '$HOME/rtc-backups/before-baseline.sqlite';" \
     | pnpm exec dotenv -e .env -- prisma db execute --stdin
   ```

   Create `~/rtc-backups` first if it doesn't exist.

2. Check that the database matches `0_init`:

   ```bash
   git checkout <the commit that added prisma/migrations>
   pnpm install --frozen-lockfile
   pnpm exec dotenv -e .env -- prisma migrate diff \
     --from-config-datasource --to-migrations prisma/migrations
   ```

   This should print `No difference detected.` If it lists changes, the
   database is on an older schema. Bring it up to date with `pnpm db:push`,
   then run the check again. `db push` stops before deleting any data and
   tells you what it would lose.

3. Record `0_init` as already applied, then go back to `main`:

   ```bash
   pnpm exec dotenv -e .env -- prisma migrate resolve --applied 0_init
   git checkout main
   ```

From now on, `./scripts/deploy.sh` applies only the migrations that come
after `0_init`.

## Updating

```bash
cd ~/rtc_restringing_app
./scripts/deploy.sh
```

[scripts/deploy.sh](scripts/deploy.sh) stops at the first step that fails, and
the running app keeps serving the old version until the final reload. Step by
step:

| Step                                       | What it does                                                                                                                           |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| `git pull --ff-only`                       | Gets the latest `main`. Refuses to merge if someone edited files on the server.                                                        |
| `pnpm install --frozen-lockfile`           | Installs exactly the versions in `pnpm-lock.yaml`. Dev dependencies are included, because the build needs them.                        |
| `pnpm db:generate`                         | Regenerates the Prisma client for the current schema.                                                                                  |
| `VACUUM INTO …`                            | Writes a consistent copy of the live database to `~/rtc-backups/rtc-<date>-<time>.sqlite`. Set `BACKUP_DIR` to back up somewhere else. |
| `pnpm db:deploy`                           | `prisma migrate deploy`: applies the new migrations in `prisma/migrations/`, in order. Does nothing when there are none.               |
| `pnpm build`                               | Builds the server into `.output/`.                                                                                                     |
| `pm2 startOrReload … --update-env`, `save` | Restarts `rtc-restringing` on the new build with the current `.env`, or starts it if it isn't running.                                 |

Backups pile up in `~/rtc-backups`. Delete old ones now and then.

Changed only `.env`? Then skip the deploy and run
`pm2 reload ecosystem.config.cjs --update-env`.

### Where migrations come from

Migrations are written during development, never on the server. After changing
`prisma/schema.prisma`, the developer runs `pnpm db:migrate --name <change>` and
commits the new folder in `prisma/migrations/`. Read its `migration.sql` before
committing: SQLite rebuilds a table to change a column, and a new required
column with no default fails on a table that already has rows.

## When something goes wrong

**Logs:** `pm2 logs rtc-restringing`. Status: `pm2 status`.

**The build or a migration failed.** The old version is still running, because
pm2 only reloads after everything else succeeded. A migration that fails
partway can leave the database half-changed. Restore the backup the script just
wrote (see below) before trying again.

**Rolling back a release.**

```bash
pm2 stop rtc-restringing
cp ~/rtc-backups/rtc-<date>-<time>.sqlite ~/rtc-data/rtc.sqlite   # the backup from that deploy
rm -f ~/rtc-data/rtc.sqlite-wal ~/rtc-data/rtc.sqlite-shm
git checkout <previous commit>
pnpm install --frozen-lockfile && pnpm db:generate && pnpm build
pm2 start ecosystem.config.cjs
```

Restoring the database loses anything members entered since that backup. When
the release didn't change the schema, roll back the code and leave the database
alone. Run `git checkout main` before the next deploy, because `git pull` doesn't
work on a detached checkout.

**Sign-in fails or loops back to the login page.** `BETTER_AUTH_URL` doesn't
match the address in the browser (`http` vs `https`, `www.` or not). Fix
`.env`, then run `pm2 reload ecosystem.config.cjs --update-env`.
