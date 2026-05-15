# Production deployment guide

This service is designed to run behind a reverse proxy (for example Nginx, Caddy, or a cloud load balancer) with TLS termination. The following checklist summarizes what production operators should verify before going live.

## 1. Runtime and process management

- Use Node.js 20 LTS or newer (see `engines` in `package.json`).
- Run the API with a process manager such as `systemd`, PM2, or Kubernetes so crashes restart automatically.
- Set `NODE_ENV=production`.
- Enable `app.set('trust proxy', 1)` only when your proxy is trusted (already configured); configure the proxy hop count appropriately for your environment.

## 2. MongoDB

- **Atlas:** Either paste the full `mongodb+srv://...` string as `MONGODB_URI`, or set `MONGODB_ATLAS_HOST` (host only, e.g. `cluster0.abcd123.mongodb.net`), `MONGODB_ATLAS_USER`, `MONGODB_ATLAS_PASSWORD`, and `MONGODB_ATLAS_DBNAME` — the app builds the URI (see `.env.example`). In Atlas: **Network Access** must allow your runtime IPs; the database user needs read/write on your database name.
- Multi-document transactions (`withTransaction`) need a **replica set** URI. Atlas `mongodb+srv` deployments satisfy this.
- Create least-privilege database users with auth enabled.
- Take regular backups and test restores.
- Ensure disk and RAM sizing can handle peak ticket issuance (writes inside transactions).

## 3. Secrets and environment

- Generate long random values for `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` (32+ characters each).
- Store Chapa keys and `CHAPA_WEBHOOK_SECRET` in a secret manager, not in source control.
- Set `COOKIE_SECURE=true` when the site is served only over HTTPS.
- Set `ALLOWED_ORIGINS` to an explicit comma-separated list of front-end origins (no wildcards).

## 4. Email (OTP)

- Configure real SMTP credentials (`MAIL_*`). Ethereal is fine for development only.
- Monitor bounce and spam rates; OTP deliverability is critical for login.

## 5. Chapa

- Use live keys only in production; keep test keys in non-production environments.
- Configure the webhook URL in the Chapa dashboard to `https://<your-api-host>/api/v1/payments/chapa/webhook`.
- Set the webhook secret hash to match `CHAPA_WEBHOOK_SECRET`.
- Set `CHAPA_CALLBACK_URL` to a route on this API that redirects users back to your front end after checkout (see `FRONTEND_URL` and the callback handler).
- After each webhook, this service **re-verifies** the transaction with Chapa before issuing tickets.

## 6. Observability

- Ship structured logs to your aggregator (Datadog, CloudWatch, ELK, and so on).
- Alert on 5xx rates, webhook failures, and Mongo transaction errors.

## 7. First admin user

1. Sign up once using the OTP flow to create the user row.
2. On the server, run `npm run promote-admin -- you@yourdomain.com` with production environment variables loaded so the account is promoted to `admin`.

## 8. Health checks

- Use `GET /health` for load balancer health checks.

## 9. Security hardening

- Keep dependencies patched (`npm audit`, automated Dependabot/Renovate).
- Restrict database and Redis networks to the application subnet only.
- Rotate JWT and Chapa secrets on a documented schedule.
