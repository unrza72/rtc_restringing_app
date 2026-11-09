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
mkdir -p "$BACKUP_DIR"
backup="$BACKUP_DIR/rtc-$(date +%Y%m%d-%H%M%S).sqlite"
echo "VACUUM INTO '$backup';" | pnpm exec dotenv -e .env -- prisma db execute --stdin
echo "Backed up the database to $backup"

pnpm db:deploy
pnpm build

pm2 startOrReload ecosystem.config.cjs --update-env
pm2 save
