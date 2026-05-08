# TaxiPool — Setup Guide

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Local Development](#local-development)
3. [Environment Variables](#environment-variables)
4. [Database Setup](#database-setup)
5. [External Service Setup](#external-service-setup)
6. [Running the API](#running-the-api)
7. [Running the Admin Panel](#running-the-admin-panel)
8. [Running the Mobile App](#running-the-mobile-app)
9. [Running Tests](#running-tests)
10. [Containerised Stack](#containerised-stack)
11. [Production Deployment](#production-deployment)
12. [Troubleshooting](#troubleshooting)

---

## Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Node.js | 20 LTS | Use [nvm](https://github.com/nvm-sh/nvm) |
| npm | ≥ 9 | Included with Node 20 |
| Docker | ≥ 24 | With Compose plugin v2 |
| Flutter | 3.x | For mobile only |
| Dart | 3.x | Bundled with Flutter |
| PostgreSQL client | ≥ 15 | `psql` for manual queries |
| Terraform | ≥ 1.6 | AWS infra only |
| AWS CLI | ≥ 2.x | AWS deployment only |

---

## Local Development

### 1. Clone the repository

```bash
git clone https://github.com/ysr39/Project-work.git
cd Project-work
```

### 2. Start backing services with Docker

This starts PostgreSQL (with PostGIS) and Redis:

```bash
docker compose -f infrastructure/docker/docker-compose.yml up -d postgres redis
```

Wait for health checks to pass:

```bash
docker compose -f infrastructure/docker/docker-compose.yml ps
# Both services should show "healthy"
```

### 3. Install API dependencies

```bash
cd apps/api && npm install
```

### 4. Configure environment

```bash
cp .env.example .env
```

Edit `.env` — the minimum required keys for local development:

```dotenv
NODE_ENV=development
JWT_SECRET=change-me-in-production
JWT_REFRESH_SECRET=change-me-too

# These match the Docker Compose defaults
DATABASE_HOST=localhost
DATABASE_USER=postgres
DATABASE_PASSWORD=postgres
DATABASE_NAME=taxipool

REDIS_HOST=localhost
```

External services (Stripe, Twilio, Firebase) are optional for local dev — the API will log OTPs to stdout and skip payment captures.

### 5. Run database migrations

```bash
npm run migration:run
```

### 6. Start the API

```bash
npm run dev
```

Swagger UI: `http://localhost:3000/api/docs`  
Health check: `http://localhost:3000/api/health`

---

## Environment Variables

Full reference for `apps/api/.env`:

### Application

| Key | Default | Description |
|---|---|---|
| `NODE_ENV` | `development` | `development` / `production` |
| `PORT` | `3000` | HTTP port |
| `FRONTEND_URL` | `http://localhost:3001` | Allowed CORS origin (mobile deep-link) |
| `ADMIN_URL` | `http://localhost:3001` | Allowed CORS origin (admin panel) |

### Database

| Key | Description |
|---|---|
| `DATABASE_HOST` | PostgreSQL hostname |
| `DATABASE_PORT` | PostgreSQL port (default 5432) |
| `DATABASE_NAME` | Database name |
| `DATABASE_USER` | Database username |
| `DATABASE_PASSWORD` | Database password |
| `DATABASE_SSL` | `true` in production (RDS requires it) |

### Redis

| Key | Description |
|---|---|
| `REDIS_HOST` | Redis hostname |
| `REDIS_PORT` | Redis port (default 6379) |
| `REDIS_PASSWORD` | Redis auth password (empty in dev) |
| `REDIS_TLS` | `true` in production (ElastiCache) |

### JWT

| Key | Description |
|---|---|
| `JWT_SECRET` | Access token signing secret (min 32 chars) |
| `JWT_EXPIRES_IN` | Access token TTL (e.g. `15m`) |
| `JWT_REFRESH_SECRET` | Refresh token signing secret |
| `JWT_REFRESH_EXPIRES_IN` | Refresh token TTL (e.g. `7d`) |

### OTP

| Key | Default | Description |
|---|---|---|
| `OTP_LENGTH` | `6` | Digits in OTP code |
| `OTP_EXPIRY_SECONDS` | `300` | OTP validity window |

### Stripe

| Key | Description |
|---|---|
| `STRIPE_SECRET_KEY` | `sk_test_...` for dev, `sk_live_...` for prod |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` from Stripe dashboard |
| `STRIPE_CURRENCY` | `inr` (or `usd`) |

### Firebase (FCM)

| Key | Description |
|---|---|
| `FIREBASE_PROJECT_ID` | Firebase project ID |
| `FIREBASE_PRIVATE_KEY` | Service account private key (with `\n`) |
| `FIREBASE_CLIENT_EMAIL` | Service account email |

### Twilio

| Key | Description |
|---|---|
| `TWILIO_ACCOUNT_SID` | `ACxxxxxxx` |
| `TWILIO_AUTH_TOKEN` | Twilio auth token |
| `TWILIO_PHONE_NUMBER` | Sender number (e.g. `+1xxxxxxxxxx`) |

### Google Maps

| Key | Description |
|---|---|
| `GOOGLE_MAPS_API_KEY` | Must have Directions + Geocoding APIs enabled |

### AWS S3 (document uploads)

| Key | Description |
|---|---|
| `AWS_REGION` | e.g. `ap-south-1` |
| `AWS_S3_BUCKET` | Bucket name for driver documents |
| `AWS_ACCESS_KEY_ID` | Only for local dev; use IAM roles in production |
| `AWS_SECRET_ACCESS_KEY` | Only for local dev |

### Rate limiting

| Key | Default | Description |
|---|---|---|
| `THROTTLE_TTL` | `60` | Window in seconds |
| `THROTTLE_LIMIT` | `100` | Max requests per window |

---

## Database Setup

### First-time (automatic via Docker init.sql)

The Docker Compose setup runs `infrastructure/docker/init.sql` on first start, enabling required PostgreSQL extensions:

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;
```

### Migrations

```bash
# Run all pending migrations
npm run migration:run

# Generate a new migration (after entity changes)
npm run migration:generate -- --name MyMigration

# Revert the last migration
npm run migration:revert
```

### Manual DB access (local)

```bash
psql -h localhost -U postgres -d taxipool
```

---

## External Service Setup

### Twilio (OTP SMS)

1. Create account at [twilio.com](https://twilio.com)
2. Get a phone number with SMS capability
3. Add `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` to `.env`

> **Dev shortcut**: Without Twilio configured, OTPs are logged to the API console. Check the terminal for `[OTP] +91xxxx → 123456`.

### Stripe (Payments)

1. Create account at [dashboard.stripe.com](https://dashboard.stripe.com)
2. Copy **Secret key** → `STRIPE_SECRET_KEY`
3. Set up webhook:
   - Local: `stripe listen --forward-to localhost:3000/api/v1/payments/webhook`
   - Copy **Webhook signing secret** → `STRIPE_WEBHOOK_SECRET`
4. Enable **Stripe Connect** for driver payouts:
   - Go to Connect → Settings → enable Express accounts

### Firebase (Push Notifications)

1. Create Firebase project at [console.firebase.google.com](https://console.firebase.google.com)
2. Project Settings → Service accounts → Generate new private key
3. Copy `project_id` → `FIREBASE_PROJECT_ID`
4. Copy `private_key` → `FIREBASE_PRIVATE_KEY` (keep `\n` escape sequences)
5. Copy `client_email` → `FIREBASE_CLIENT_EMAIL`

### Google Maps

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Enable: **Maps JavaScript API**, **Directions API**, **Geocoding API**, **Places API**
3. Create an API key and restrict it to your server IPs
4. Set `GOOGLE_MAPS_API_KEY`

---

## Running the API

```bash
cd apps/api

# Development (hot-reload)
npm run dev

# Production build + start
npm run build
npm start

# Lint
npm run lint
```

| URL | Description |
|---|---|
| `http://localhost:3000/api/v1` | REST API base |
| `http://localhost:3000/api/docs` | Swagger UI |
| `http://localhost:3000/api/health` | Health check |
| `ws://localhost:3000` | Socket.IO |

---

## Running the Admin Panel

```bash
cd apps/admin
npm install
npm run dev
# → http://localhost:3001
```

> Default admin credentials depend on your seed data. Create an admin user directly in the DB or via an admin-seeding script.

### Build for production

```bash
VITE_API_URL=https://api.taxipool.app npm run build
# Outputs to apps/admin/dist/
```

---

## Running the Mobile App

### Prerequisites

- Android Studio or Xcode (for simulator)
- `GOOGLE_MAPS_API_KEY` added to:
  - Android: `apps/mobile/android/app/src/main/AndroidManifest.xml`
  - iOS: `apps/mobile/ios/Runner/AppDelegate.swift`

### Commands

```bash
cd apps/mobile

# Install dependencies
flutter pub get

# Run on connected device / emulator
flutter run

# Run on specific device
flutter run -d <device-id>

# Build APK (Android)
flutter build apk --release

# Build IPA (iOS)
flutter build ipa --release
```

### Configure API endpoint

Edit `apps/mobile/lib/core/network/api_client.dart`:

```dart
static const String baseUrl = 'https://api.taxipool.app/api/v1';
```

For local development, replace with your machine's local IP (not `localhost`):

```dart
static const String baseUrl = 'http://192.168.1.x:3000/api/v1';
```

---

## Running Tests

```bash
cd apps/api

# Unit tests
npm test

# Unit tests with coverage
npm run test:cov

# E2E integration tests (requires running Postgres + Redis)
npm run test:e2e
```

Coverage report is generated in `apps/api/coverage/`.

---

## Containerised Stack

### Full local stack (all services)

```bash
docker compose -f infrastructure/docker/docker-compose.yml up -d
```

This starts: Postgres, Redis, API (hot-reload mode), Admin panel.

### Production stack

```bash
docker compose \
  -f infrastructure/docker/docker-compose.yml \
  -f infrastructure/docker/docker-compose.prod.yml \
  up -d
```

Requires `apps/api/.env.production` to exist.

### Useful Docker commands

```bash
# View API logs
docker compose -f infrastructure/docker/docker-compose.yml logs -f api

# Restart only the API
docker compose -f infrastructure/docker/docker-compose.yml restart api

# Stop everything and remove volumes
docker compose -f infrastructure/docker/docker-compose.yml down -v
```

---

## Production Deployment

See [`infrastructure/DEPLOY.md`](../infrastructure/DEPLOY.md) for the complete runbook.

**TL;DR**:

1. Bootstrap Terraform state S3 bucket + DynamoDB lock table
2. Run `terraform init && terraform apply` to provision AWS resources
3. Store secrets in SSM Parameter Store
4. Set 3 secrets in GitHub: `AWS_ROLE_ARN`, `ADMIN_S3_BUCKET`, `CF_DISTRIBUTION_ID`
5. Push to `main` — CI/CD handles the rest

---

## Troubleshooting

### `pg_isready` fails / database won't start

```bash
docker compose -f infrastructure/docker/docker-compose.yml logs postgres
# Look for permission or port conflict errors
# Port 5432 may already be used by a local Postgres:
lsof -i :5432
```

### Redis connection refused

```bash
docker compose -f infrastructure/docker/docker-compose.yml logs redis
# Restart Redis
docker compose -f infrastructure/docker/docker-compose.yml restart redis
```

### OTP not received

OTPs are logged to console when `NODE_ENV=development` regardless of Twilio config. Check the API terminal:

```
[OTP] +91xxxxxxxxxx → 523841
```

### Stripe webhook signature failure

Run the Stripe CLI listener to forward webhooks locally:

```bash
stripe listen --forward-to localhost:3000/api/v1/payments/webhook
```

Copy the signing secret it prints → update `STRIPE_WEBHOOK_SECRET` in `.env`.

### TypeORM migration fails

```bash
# Ensure the database exists
psql -h localhost -U postgres -c "CREATE DATABASE taxipool;"

# Re-run migrations
npm run migration:run
```

### Flutter maps not showing

- Ensure `GOOGLE_MAPS_API_KEY` is valid and has the Maps SDK enabled
- On Android, confirm the key is in `AndroidManifest.xml` under `<meta-data>`
- On iOS, confirm `GMSServices.provideAPIKey(...)` is called in `AppDelegate`

### Port already in use

```bash
# Find what's using port 3000
lsof -i :3000 | grep LISTEN
kill -9 <PID>
```
