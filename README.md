# Tamcon weekly lottery API

Express + MongoDB backend for a weekly draw lottery with **email OTP authentication**, **JWT access and refresh tokens** (optional **httpOnly cookies**), **Chapa** card payments in test or live mode, and an **admin** console API for KPIs and manual weekly draws.

## Quick start

1. Copy environment defaults and fill in secrets:

```bash
cp .env.example .env
```

2. Install dependencies and run (MongoDB must be reachable):

```bash
npm install
npm run dev
```

3. Create a user via `POST /auth/register`, or insert in MongoDB. Promote an admin with:

```bash
npm run promote-admin -- you@example.com
```

## API surface (prefix `/api/v1`)

| Area | Method | Path | Notes |
|------|--------|------|------|
| Auth | POST | `/auth/register` | Create customer account (`email`, `fullName`) |
| Auth | POST | `/auth/otp/request` | Sends 6-digit OTP (email must exist in `users`) |
| Auth | POST | `/auth/otp/verify` | Returns tokens; set `useHttpOnlyCookies` (default `true`) |
| Auth | POST | `/auth/refresh` | Accepts refresh cookie or JSON body |
| Auth | POST | `/auth/logout` | Requires `Authorization` bearer or access cookie |
| Auth | GET | `/auth/me` | Current profile |
| Lottery | GET | `/lottery/current` | Active weekly draw + ticket price |
| Lottery | GET | `/lottery/tickets/mine` | Paginated tickets |
| Payments | POST | `/payments/checkout` | Creates Chapa session (`checkoutUrl`) |
| Payments | GET | `/payments/chapa/callback` | Browser return URL configured in Chapa |
| Webhook | POST | `/api/v1/payments/chapa/webhook` | Raw JSON + signature verification |
| Admin | GET | `/admin/kpis` | `totalUsers`, `totalRevenue`, `ticketsSold`, `totalPrizePoolFromDraws`, `winnersCount`, `completedDraws` |
| Admin | GET | `/admin/users` | Paginated users (`?page`, `limit`, optional `role`, `search`) |
| Admin | GET | `/admin/charts/revenue-weeks` | Completed draws for charts |
| Admin | GET | `/admin/transactions` | Wallet ledger |
| Admin | GET | `/admin/draws` | Filterable draw list |
| Admin | GET | `/admin/draws/history` | Completed draws only |
| Admin | POST | `/admin/draws/trigger` | Runs draw, credits wallets atomically |

## Architecture

Source lives under `src/` with controllers, services, models, routes, middlewares, validators, config, jobs, and utilities. Core business rules:

- **Weekly window**: Monday–Sunday in `WEEKLY_DRAW_TIMEZONE` (Luxon), one open draw document at a time for the active calendar window.
- **Tickets**: random numeric codes (`crypto.randomInt`), unique per draw via compound index.
- **Prize pool**: `floor(revenue * PRIZE_POOL_PERCENT)` with default 53% of successful Chapa payments for that draw.
- **Winning number**: uniform random over the ticket number space; tickets with an exact match split the pool (remainder distributed one birr at a time across winners).
- **Wallet balance**: increased when a draw pays prizes (`win_reward` rows in `wallet_transactions`). Chapa ticket purchases are recorded in `payments` + `tickets`; this codebase does **not** auto-create `ticket_purchase` wallet rows on Chapa (that would imply an internal wallet debit). Add that flow if users buy from balance.

## Further reading

See `DEPLOYMENT.md` for replica sets, TLS, secrets, and scaling guidance.
