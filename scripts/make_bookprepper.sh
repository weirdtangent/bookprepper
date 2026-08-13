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
rm -f packages/types/tsconfig.tsbuildinfo
rm -rf apps/api/dist
rm -rf apps/web/dist
rm -rf packages/db/dist
rm -rf packages/config/dist
rm -rf packages/types/dist

# Clean, reproducible install that matches CI (fresh checkout + --frozen-lockfile).
# A plain incremental `pnpm install` over the persistent node_modules can strand an
# orphaned transitive version after a dependabot bump — e.g. an old @types/react
# lingering next to the bumped one. Two React type identities then make JSX props
# resolve to `any`, breaking `tsc -b` with TS7031 on render-prop callbacks
# (className={({ isActive }) => ...}) even though CI is green. Wiping node_modules
# and using --frozen-lockfile keeps deploys byte-for-byte identical to CI.
rm -rf node_modules apps/*/node_modules packages/*/node_modules
pnpm install --frozen-lockfile
pnpm --filter db prisma generate
pnpm --filter db prisma migrate deploy

# Build packages in correct order: config -> db -> types -> apps
pnpm --filter config build
pnpm --filter db build
pnpm --filter types build
pnpm covers:cache
pnpm --filter api build

# Write the current release version (nearest git tag) into VERSION so the SPA
# header shows the real semantic-release version. vite.config.ts reads ../../VERSION
# first, falling back to package.json (a static 1.5.0) when the file is absent.
# semantic-release is tag-only here (no @semantic-release/git), so package.json never
# reflects the release — this bridges that gap at build time. VERSION is gitignored.
# Guarded so a git hiccup (no tags / shallow clone) can't abort the deploy under
# `set -e`; on failure we drop VERSION and let vite fall back. --abbrev=0 yields a
# clean tag (v1.6.4) rather than a v1.6.4-3-g<sha> describe string.
if release_version="$(git describe --tags --abbrev=0 2>/dev/null)"; then
  printf '%s\n' "${release_version#v}" > VERSION
else
  rm -f VERSION
fi

pnpm --filter web build

sudo systemctl restart bookprepper

# Install the health-check watchdog if it isn't already running. These units used
# to be install-by-hand, which meant they were simply absent on graystorm — so
# when the API lost its database on 2026-08-13 nothing noticed for 88 minutes.
# Idempotent: `install` only rewrites on change, and the daemon-reload/enable pair
# is a no-op once the timer is active.
for unit in bookprepper-healthcheck.service bookprepper-healthcheck.timer; do
  if ! cmp -s "${REPO_DIR}/deploy/${unit}" "/etc/systemd/system/${unit}"; then
    sudo install -m 0644 "${REPO_DIR}/deploy/${unit}" "/etc/systemd/system/${unit}"
    reload_units=1
  fi
done
if [[ -n "${reload_units:-}" ]]; then
  sudo systemctl daemon-reload
fi
sudo systemctl enable --now bookprepper-healthcheck.timer
if [[ -n "${reload_units:-}" ]]; then
  # `enable --now` starts a stopped timer but will not restart a running one, so
  # an edited schedule (OnUnitActiveSec, say) would otherwise keep the old cadence
  # until the next reboot.
  sudo systemctl restart bookprepper-healthcheck.timer
fi

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
