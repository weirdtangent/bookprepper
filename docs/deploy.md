# Deployment Guide

This project targets an AWS EC2 host with MySQL and Nginx already installed. The repository is a pnpm monorepo with a Fastify API (`apps/api`) and a Vite React SPA (`apps/web`).

## Prerequisites

- Node.js 20+
- pnpm (`corepack enable pnpm`)
- MySQL 8.x server (running on your EC2 instance)
- Nginx (or another reverse proxy)
- AWS Cognito User Pool configured with Google + Apple SSO

## Environment variables

Create an `.env` file at the repo root by copying `.env.example` and updating values:

```bash
cp .env.example .env
```

Key settings:

| Variable | Description |
| --- | --- |
| `MYSQL_*` / `DATABASE_URL` | Connection details for the MySQL database |
| `API_PORT` | Port for the Fastify server (default `4000`) |
| `COGNITO_*` | Backend Cognito values used for token verification |
| `VITE_API_BASE_URL` | Public URL of the API (e.g., `https://api.bookprepper.com`) |
| `VITE_COGNITO_*` | Frontend Cognito values used by Amplify |

## Install dependencies

```bash
pnpm install
```

## Generate Prisma client & run migrations

```bash
# Generate the Prisma client once
pnpm --filter db prisma generate

# Apply migrations (requires the MySQL database to be reachable)
pnpm --filter db prisma migrate deploy

# Seed the classic catalog (idempotent)
pnpm --filter db prisma db seed
```

## Build artifacts

```bash
# Build shared packages (config + db)
pnpm --filter config build
pnpm --filter db build

# Build the API
pnpm --filter api build

# Build the SPA (outputs to apps/web/dist)
pnpm --filter web build
```

## Run the API (systemd/pm2 suggestion)

The compiled API entry point is `apps/api/dist/server.js`. Example systemd unit:

```
[Unit]
Description=BookPrepper API
After=network.target mysql.service

[Service]
Type=simple
WorkingDirectory=/var/www/bookprepper
ExecStart=/usr/bin/node apps/api/dist/server.js
EnvironmentFile=/var/www/bookprepper/.env
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

Alternatively, start it manually:

```bash
API_PORT=4000 pnpm --filter api start
```

## Deploy the SPA

1. Copy `apps/web/dist` to `/var/www/bookprepper/web`.
2. Ensure the directory is readable by Nginx: `sudo chown -R www-data:www-data /var/www/bookprepper/web`.

## Nginx

Use `deploy/nginx.conf` as a starting point. It serves the SPA and proxies `/api/**` to the Fastify server running on `127.0.0.1:4000`.

```bash
sudo cp deploy/nginx.conf /etc/nginx/sites-available/bookprepper.conf
sudo ln -s /etc/nginx/sites-available/bookprepper.conf /etc/nginx/sites-enabled/bookprepper.conf
sudo nginx -t && sudo systemctl reload nginx
```

For HTTPS, wrap the server block with your TLS configuration or use AWS Certificate Manager + ALB.

## Cognito setup (Google + Apple SSO)

1. **Create a User Pool**
   - In AWS Cognito, create a User Pool in the same region where the API runs (the backend uses `COGNITO_REGION`).
   - Create an App Client without a client secret (suitable for SPA flows) and enable “Authorization code grant” under OAuth.
   - Under “App integration → Domain,” claim a hosted UI domain (e.g., `https://example-domain.auth.us-east-1.amazoncognito.com`).

2. **Configure social identity providers**
   - In “Federation → Identity providers,” add Google and Apple, supplying the client IDs/secrets from their developer consoles.
   - Map the IdPs to the App Client so they appear on the hosted UI.

3. **Redirect URLs**
   - Add your production and dev URLs to the hosted UI callback + sign-out lists (e.g., `https://bookprepper.com/` and `http://localhost:5173/`).
   - These map to `COGNITO_REDIRECT_SIGNIN`, `COGNITO_REDIRECT_SIGNOUT` and the Vite equivalents (`VITE_COGNITO_*`).

4. **Scopes & attributes**
   - Ensure `email` and `openid` scopes are enabled.
   - Expose the `email` attribute in the ID token so the backend can associate Cognito users with local profiles.

5. **Environment variables recap**
   - Backend `.env`: `COGNITO_USER_POOL_ID`, `COGNITO_CLIENT_ID`, `COGNITO_REGION`, `COGNITO_DOMAIN`.
   - Frontend Vite env: `VITE_COGNITO_USER_POOL_ID`, `VITE_COGNITO_CLIENT_ID`, `VITE_COGNITO_REGION`, `VITE_COGNITO_DOMAIN`, `VITE_COGNITO_REDIRECT_SIGNIN`, `VITE_COGNITO_REDIRECT_SIGNOUT`.

After completing these steps, visiting the hosted UI or invoking `signInWithRedirect` from the SPA should send readers through Google/Apple SSO and back with an ID token the API can verify.

## Ongoing maintenance

- When schema changes occur: `pnpm --filter db prisma migrate deploy` followed by `pnpm --filter db prisma db seed`.
- After code updates, rebuild and redeploy artifacts (`pnpm -r build`).
- Monitor API logs via systemd (`journalctl -u bookprepper --follow`) or pm2.

