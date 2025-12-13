#!/bin/zsh
set -euo pipefail

# Update these paths if your deployment lives elsewhere.
REPO_DIR="${REPO_DIR:-/opt/bookprepper}"
WEB_DIR="${WEB_DIR:-/www/bookprepper}"

ENV_FILE="${REPO_DIR}/.env"
DIST_DIR="${REPO_DIR}/apps/web/dist"

cd "$REPO_DIR"

if [[ -f "$ENV_FILE" ]]; then
  set -a
  source "$ENV_FILE"
  set +a
fi

# Clean TypeScript build cache to ensure fresh types after schema changes
rm -f apps/api/tsconfig.tsbuildinfo
rm -f apps/web/tsconfig.tsbuildinfo
rm -f packages/db/tsconfig.tsbuildinfo
rm -f packages/config/tsconfig.tsbuildinfo
rm -rf apps/api/dist
rm -rf apps/web/dist
rm -rf packages/db/dist
rm -rf packages/config/dist

pnpm install
pnpm --filter db prisma generate
pnpm --filter db prisma migrate deploy

# Build packages in correct order: config -> db -> api, web
pnpm --filter config build
pnpm --filter db build
pnpm covers:cache
pnpm --filter api build
pnpm --filter web build

sudo systemctl restart bookprepper

# Pass 1: mirror everything except cover JPEGs (manifest JSON still replaced)
sudo rsync -a --delete \
  --exclude='assets/covers/*.jpg' \
  "$DIST_DIR/" \
  "$WEB_DIR/"

# Pass 2: copy only missing JPEGs; never touch ones that already exist
sudo rsync -a --ignore-existing \
  --include='assets/' \
  --include='assets/covers/' \
  --include='assets/covers/*.jpg' \
  --exclude='*' \
  "$DIST_DIR/" \
  "$WEB_DIR/"

sudo chown -R www-data:www-data "$WEB_DIR"
