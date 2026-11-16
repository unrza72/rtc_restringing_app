#!/usr/bin/env bash
# Updates the production checkout to the latest main and restarts it under pm2.
# Run from anywhere on the server: ./scripts/deploy.sh — see DEPLOYMENT.md.
set -euo pipefail
cd "$(dirname "$0")/.."

BACKUP_DIR="${BACKUP_DIR:-$HOME/rtc-backups}"

git pull --ff-only
pnpm install --frozen-lockfile
pnpm db:generate

# A consistent copy of the live database, taken before any migration runs.
# pg_dump gets the connection from DATABASE_URL in .env, with the password in
# PGPASSWORD rather than on the command line, where `ps` would show it.
mkdir -p "$BACKUP_DIR"
backup="$BACKUP_DIR/rtc-$(date +%Y%m%d-%H%M%S).dump"
{ read -r db_url; IFS= read -r db_password || true; } < <(node --env-file=.env -e '
  const url = new URL(process.env.DATABASE_URL)
  const password = decodeURIComponent(url.password)
  url.password = ""
  url.searchParams.delete("schema") // Prisma-only, pg_dump would refuse it
  console.log(url.toString())
  console.log(password)
')
PGPASSWORD="$db_password" pg_dump --format=custom --file="$backup" "$db_url"
echo "Backed up the database to $backup"

pnpm db:deploy
pnpm build

pm2 startOrReload ecosystem.config.cjs --update-env
pm2 save
