<div align="center">

# TaxiPool

**Production-grade Uber Pool–style ride-sharing platform**

[![CI](https://github.com/ysr39/Project-work/actions/workflows/ci.yml/badge.svg)](https://github.com/ysr39/Project-work/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

[Architecture](#architecture) · [Features](#features) · [Quick Start](#quick-start) · [API Docs](#api-documentation) · [Deployment](#deployment)

</div>

---

## Overview

TaxiPool is a full-stack ride-pooling platform that matches multiple riders heading in the same direction into a single vehicle — reducing cost for riders, increasing earnings for drivers, and cutting city congestion.

Built in 12 phases from product discovery through production deployment.

---

## Features

| Category | What's included |
|---|---|
| **Auth** | Phone OTP login (Twilio), JWT access/refresh tokens, role-based access (RIDER / DRIVER / ADMIN) |
| **Pooling Engine** | Haversine + stop-optimizer, route scorer, fare calculator with 35% pool discount |
| **Realtime** | Socket.IO with Redis adapter (horizontally scalable), live driver tracking, trip status push, FCM offline notifications |
| **Payments** | Stripe manual-capture PaymentIntents, Wallet (pessimistic-lock, idempotent), tiered driver commission (25→15%), Stripe Connect payouts |
| **Admin Panel** | React dashboard — KPIs, driver approval, ride monitoring, revenue reports, refunds |
| **Mobile App** | Flutter (iOS + Android) — OTP auth, booking flow, Google Maps tracking, wallet, history |
| **DevOps** | Docker, GitHub Actions CI/CD, AWS ECS Fargate + RDS + ElastiCache + CloudFront (Terraform) |
| **Testing** | Jest unit tests (6 suites), Supertest e2e tests (3 suites), 100% TypeScript |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Clients                              │
│  Flutter App (iOS/Android)    React Admin (CloudFront/S3)   │
└──────────────────┬────────────────────────┬────────────────┘
                   │  HTTPS / WSS           │  HTTPS
                   ▼                        ▼
          ┌────────────────┐      ┌──────────────────┐
          │   ALB (AWS)    │      │  CloudFront CDN  │
          └───────┬────────┘      └──────────────────┘
                  │
          ┌───────▼────────────────────────────┐
          │     NestJS API   (ECS Fargate ×2)  │
          │  REST /api/v1  +  Socket.IO /ws    │
          └──────┬──────────────┬──────────────┘
                 │              │
       ┌─────────▼──┐    ┌──────▼──────┐
       │  RDS        │    │ ElastiCache │
       │ PostgreSQL  │    │   Redis     │
       │ (Multi-AZ)  │    │ (HA pair)   │
       └─────────────┘    └─────────────┘
```

### Monorepo layout

```
Project-work/
├── apps/
│   ├── api/              NestJS backend (Node 20)
│   │   └── src/
│   │       ├── modules/  auth · users · drivers · trips · pooling
│   │       │             payments · admin · locations · notifications
│   │       ├── sockets/  Socket.IO gateway + Redis adapter
│   │       ├── common/   guards · filters · interceptors · decorators
│   │       └── database/ TypeORM migrations + data-source
│   ├── admin/            React 18 + Vite + Tailwind admin panel
│   └── mobile/           Flutter 3.x mobile app
├── infrastructure/
│   ├── docker/           docker-compose (dev + prod)
│   ├── nginx/            Nginx reverse proxy config
│   └── terraform/        AWS infrastructure (7 modules)
├── docs/                 This documentation
└── .github/workflows/    CI (ci.yml) + Deploy (deploy.yml)
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| **API** | NestJS 10, TypeScript, TypeORM, PostgreSQL 15 + PostGIS |
| **Realtime** | Socket.IO 4 + `@socket.io/redis-adapter` |
| **Cache / Pub-Sub** | Redis 7 (ioredis) |
| **Payments** | Stripe (PaymentIntents, Connect Express, Webhooks) |
| **SMS** | Twilio Verify |
| **Push Notifications** | Firebase Cloud Messaging (`firebase-admin`) |
| **Maps** | Google Maps Platform (Directions, Geocoding) |
| **Admin** | React 18, Vite, Tailwind CSS, React Query, Recharts, Zustand |
| **Mobile** | Flutter 3, BLoC/Cubit, GoRouter, GetIt, `google_maps_flutter`, `flutter_stripe` |
| **Infrastructure** | AWS ECS Fargate, RDS, ElastiCache, ALB, CloudFront, S3, ECR |
| **IaC** | Terraform ≥ 1.6 |
| **CI/CD** | GitHub Actions (OIDC auth — no static AWS keys) |
| **Testing** | Jest 29, Supertest, ts-jest |

---

## Quick Start

### Prerequisites

| Tool | Version |
|---|---|
| Node.js | 20 LTS |
| Docker + Docker Compose | ≥ 24 |
| Flutter | 3.x (for mobile) |

### 1. Clone and install

```bash
git clone https://github.com/ysr39/Project-work.git
cd Project-work
```

### 2. Start backing services

```bash
docker compose -f infrastructure/docker/docker-compose.yml up -d postgres redis
```

### 3. Configure the API

```bash
cd apps/api
cp .env.example .env
# Edit .env — at minimum set JWT_SECRET and JWT_REFRESH_SECRET
```

### 4. Run the API

```bash
cd apps/api
npm install
npm run migration:run
npm run dev
# → http://localhost:3000/api/v1
# → Swagger: http://localhost:3000/api/docs
```

### 5. Run the Admin Panel

```bash
cd apps/admin
npm install
npm run dev
# → http://localhost:3001
```

### 6. Run the Mobile App

```bash
cd apps/mobile
flutter pub get
flutter run
```

> Full environment variable reference: [`apps/api/.env.example`](apps/api/.env.example)  
> Detailed setup: [`docs/SETUP.md`](docs/SETUP.md)

---

## API Documentation

- **Swagger UI** (local): `http://localhost:3000/api/docs`
- **Endpoint Reference**: [`docs/API.md`](docs/API.md)
- **Postman Collection**: [`docs/TaxiPool.postman_collection.json`](docs/TaxiPool.postman_collection.json)

Base URL: `https://api.taxipool.app/api/v1`

All protected endpoints require:
```
Authorization: Bearer <accessToken>
```

---

## WebSocket Events

Connect to `wss://api.taxipool.app` with query param `token=<accessToken>`.

| Direction | Event | Description |
|---|---|---|
| Client → Server | `driver:location` | Stream GPS coordinates |
| Client → Server | `driver:online` | Go online (driver) |
| Client → Server | `driver:offline` | Go offline (driver) |
| Client → Server | `trip:accept` | Driver accepts trip request |
| Client → Server | `trip:decline` | Driver declines trip request |
| Client → Server | `trip:arrived` | Driver arrived at pickup |
| Client → Server | `trip:pickup` | Rider picked up |
| Client → Server | `trip:dropoff` | Rider dropped off |
| Client → Server | `trip:join_room` | Join a trip room |
| Server → Client | `trip:matched` | Ride matched — driver assigned |
| Server → Client | `trip:driver_location` | Live driver coordinates |
| Server → Client | `trip:status_changed` | Status FSM update |
| Server → Client | `trip:completed` | Ride completed + fare |
| Server → Client | `trip:cancelled` | Ride cancelled |
| Server → Client | `trip:no_driver` | No driver found |

---

## Trip Status FSM

```
SEARCHING → MATCHED → ARRIVING → ARRIVED → IN_PROGRESS → COMPLETED
     ↓           ↓         ↓          ↓
  CANCELLED  CANCELLED CANCELLED  CANCELLED
```

---

## Commission Tiers

| Monthly trips | Commission | Tier |
|---|---|---|
| 0 – 30 | 25% | Standard |
| 31 – 80 | 20% | Silver |
| 81 – 150 | 17% | Gold |
| 151+ | 15% | Platinum |

---

## Deployment

See [`infrastructure/DEPLOY.md`](infrastructure/DEPLOY.md) for the complete runbook including:

- Terraform bootstrap (S3 state + DynamoDB locks)
- AWS infrastructure provisioning
- SSM Parameter Store secrets setup
- GitHub Actions OIDC configuration
- DNS, TLS, and first-deploy steps

Quick deploy via CI: push to `main` — GitHub Actions builds, pushes to ECR, deploys to ECS, and syncs the admin panel to S3/CloudFront automatically.

---

## Testing

```bash
cd apps/api

# Unit tests
npm test

# Unit tests with coverage report
npm run test:cov

# E2E integration tests (requires Postgres + Redis)
npm run test:e2e
```

Test suites:

| Suite | Tests |
|---|---|
| `auth.service.spec` | sendOtp, verifyOtp, refresh, logout |
| `trip-fsm.service.spec` | All FSM transitions (valid + invalid) |
| `trips.service.spec` | Fare estimate, create, findById, updateStatus |
| `commission.service.spec` | All 4 tiers, arithmetic invariants |
| `wallet.service.spec` | getBalance, debit, creditRefund, idempotency |
| `payments.service.spec` | PaymentIntent, capture, webhook, refund |
| `auth.e2e-spec` | Full OTP → JWT → protected route flow |
| `trips.e2e-spec` | Trip CRUD + FSM enforcement over HTTP |
| `payments.e2e-spec` | Wallet, top-up, Stripe webhook, role guards |

---

## Project Phases

| Phase | Description | Status |
|---|---|---|
| 1 | Product discovery + requirements | ✅ |
| 2 | System architecture | ✅ |
| 3 | Database design | ✅ |
| 4 | Backend — NestJS API | ✅ |
| 5 | Pooling engine (matching + routing) | ✅ |
| 6 | Realtime system (Socket.IO) | ✅ |
| 7 | Flutter mobile app | ✅ |
| 8 | React admin panel | ✅ |
| 9 | Stripe payments + wallet | ✅ |
| 10 | DevOps (Docker, CI/CD, Terraform) | ✅ |
| 11 | Testing (Jest + Supertest) | ✅ |
| 12 | Documentation | ✅ |

---

## License

MIT © 2025 TaxiPool
