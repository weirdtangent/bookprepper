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

pnpm install
pnpm --filter db prisma generate
pnpm --filter db prisma migrate deploy
pnpm build

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
