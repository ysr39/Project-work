# TaxiPool — API Reference

**Base URL**: `https://api.taxipool.app/api/v1`  
**Content-Type**: `application/json`  
**Interactive docs**: `http://localhost:3000/api/docs` (Swagger UI)

## Authentication

All protected endpoints require a Bearer token:

```
Authorization: Bearer <accessToken>
```

Tokens are obtained via the Auth flow. Access tokens expire in **15 minutes**; use the refresh endpoint to rotate them without re-login.

## Response Envelope

All responses are wrapped:

```jsonc
// Success
{ "data": { ... }, "statusCode": 200 }

// Error
{ "statusCode": 400, "message": "Validation failed", "errors": [...] }
```

## Roles

| Role | Description |
|---|---|
| `RIDER` | Books rides, makes payments, views history |
| `DRIVER` | Accepts trips, manages status, receives payouts |
| `ADMIN` | Full access — approvals, reports, refunds |

---

## Auth

### POST `/auth/send-otp`
**Public** — Send a one-time password to a phone number.

**Request**
```json
{ "phone": "+919876543210" }
```

**Response `200`**
```json
{ "message": "OTP sent successfully" }
```

---

### POST `/auth/verify-otp`
**Public** — Verify OTP and receive JWT tokens. Creates account on first login.

**Request**
```json
{
  "phone": "+919876543210",
  "otp":   "523841",
  "role":  "RIDER"          // "RIDER" | "DRIVER"
}
```

**Response `200`**
```json
{
  "accessToken":  "eyJ...",
  "refreshToken": "eyJ...",
  "isNew": true,
  "user": {
    "id":    "uuid",
    "phone": "+919876543210",
    "role":  "RIDER",
    "fullName": null
  }
}
```

**Errors**: `400` Invalid/expired OTP

---

### POST `/auth/refresh`
**Public** — Exchange a refresh token for a new access + refresh token pair (rotation).

**Request**
```json
{ "refreshToken": "eyJ..." }
```

**Response `200`**
```json
{ "accessToken": "eyJ...", "refreshToken": "eyJ..." }
```

**Errors**: `401` Invalid or revoked token

---

### POST `/auth/logout`
**Requires auth** — Revoke the supplied refresh token.

**Request**
```json
{ "refreshToken": "eyJ..." }
```

**Response `200`** `{}`

---

## Users

### GET `/users/me`
**Requires auth** — Get the current user's profile.

**Response `200`**
```json
{
  "id": "uuid",
  "phone": "+919876543210",
  "fullName": "Priya Sharma",
  "email": "priya@example.com",
  "role": "RIDER",
  "status": "ACTIVE",
  "isPhoneVerified": true
}
```

---

### PATCH `/users/me`
**Requires auth** — Update profile fields.

**Request**
```json
{ "fullName": "Priya Sharma", "email": "priya@example.com" }
```

**Response `200`** — Updated user object.

---

### GET `/users` *(Admin)*
**Role: ADMIN** — List all users (paginated).

**Query params**: `page`, `limit`

**Response `200`**
```json
{ "items": [...], "total": 240, "page": 1, "limit": 20 }
```

---

## Drivers

### POST `/drivers/onboard`
**Role: DRIVER** — Submit onboarding details (license + vehicle).

**Request**
```json
{
  "licenseNumber":      "KA01 20240001",
  "licenseExpiry":      "2028-06-30",
  "vehicleMake":        "Maruti",
  "vehicleModel":       "Swift",
  "vehicleYear":        2022,
  "vehicleColor":       "White",
  "plateNumber":        "KA05AB1234",
  "vehicleType":        "SEDAN",
  "registrationNumber": "REG20220001"
}
```

**Response `201`** — Driver profile object.

**Errors**: `400` Validation, `409` Already onboarded

---

### GET `/drivers/me`
**Role: DRIVER** — Full driver profile with vehicle and documents.

**Response `200`**
```json
{
  "id": "uuid",
  "userId": "uuid",
  "licenseNumber": "KA01 20240001",
  "approvalStatus": "PENDING",
  "isOnline": false,
  "rating": 4.8,
  "totalTrips": 142,
  "vehicle": { "make": "Maruti", "model": "Swift", "plateNumber": "KA05AB1234" },
  "documents": [...]
}
```

---

### PATCH `/drivers/me/status`
**Role: DRIVER** — Toggle online / offline.

**Request**
```json
{ "isOnline": true }
```

**Response `200`** — Updated driver profile.

---

## Trips

### POST `/trips/estimate`
**Role: RIDER** — Calculate fare before booking (no trip created).

**Request**
```json
{
  "tripType":       "POOL",
  "pickupLat":      12.9716,
  "pickupLng":      77.5946,
  "dropoffLat":     12.9698,
  "dropoffLng":     77.7500,
  "pickupAddress":  "MG Road, Bangalore",
  "dropoffAddress": "Whitefield, Bangalore",
  "seatsRequested": 1
}
```

**Response `200`**
```json
{
  "distanceKm":       17.4,
  "soloFare":         238.8,
  "poolFarePerRider": 155.2,
  "poolSavings":       83.6,
  "poolDiscountPct":    35
}
```

---

### POST `/trips`
**Role: RIDER** — Create a trip request and enter the matching queue.

**Request** — same body as `/trips/estimate`

**Response `201`**
```json
{
  "trip": {
    "id":     "uuid",
    "status": "SEARCHING",
    "tripType": "POOL",
    "pickupAddress": "MG Road, Bangalore",
    "dropoffAddress": "Whitefield, Bangalore",
    "totalDistanceKm": 17.4
  },
  "passenger": {
    "id":            "uuid",
    "seatsRequested": 1,
    "finalFare":      155.2
  }
}
```

---

### GET `/trips/:id`
**Requires auth** — Get trip details.

**Response `200`**
```json
{
  "id":           "uuid",
  "status":       "IN_PROGRESS",
  "tripType":     "POOL",
  "driverId":     "uuid",
  "startedAt":    "2025-01-15T09:12:00Z",
  "passengers":   [...]
}
```

**Errors**: `404` Not found

---

### PATCH `/trips/:id/status`
**Role: DRIVER or ADMIN** — Advance the trip FSM.

**Request**
```json
{ "status": "ARRIVED" }
```

Valid transitions:
```
SEARCHING → MATCHED → ARRIVING → ARRIVED → IN_PROGRESS → COMPLETED
                                              (all → CANCELLED)
```

**Response `200`** — Updated trip.

**Errors**: `400` Invalid FSM transition, `403` Not the assigned driver

---

### DELETE `/trips/:id`
**Role: RIDER** — Cancel a trip (only while SEARCHING or MATCHED).

**Request body** *(optional)*
```json
{ "reason": "Changed plans" }
```

**Response `200`** `{}`

**Errors**: `400` Cannot cancel after pickup

---

### GET `/trips/history`
**Role: RIDER** — Paginated ride history.

**Query**: `page`, `limit`

**Response `200`**
```json
{ "items": [...], "total": 18, "page": 1, "limit": 10 }
```

---

### GET `/trips/driver/history`
**Role: DRIVER** — Paginated completed trips for the driver.

---

## Pooling

### POST `/pooling/request`
**Role: RIDER** — Request a ride through the full pooling pipeline (matching + fare).

**Request**
```json
{
  "tripType":       "POOL",
  "pickupLat":      12.9716,
  "pickupLng":      77.5946,
  "dropoffLat":     12.9698,
  "dropoffLng":     77.7500,
  "pickupAddress":  "MG Road, Bangalore",
  "dropoffAddress": "Whitefield, Bangalore",
  "seatsRequested": 2
}
```

**Response `201`** — Trip + passenger + matched driver (if available).

---

### POST `/pooling/estimate`
**Public** — Fare estimate via the pooling engine (more accurate than `/trips/estimate` for multi-stop routes).

---

## Payments

### POST `/payments/intent`
**Role: RIDER** — Create a Stripe PaymentIntent (authorize-only; captured on trip completion).

**Request**
```json
{
  "tripPassengerId": "uuid",
  "paymentMethod":   "CARD"
}
```

**Response `201`**
```json
{
  "clientSecret": "pi_xxx_secret_xxx",
  "paymentId":    "uuid",
  "amount":       155.2,
  "currency":     "INR"
}
```

> Use `clientSecret` with Stripe.js / `flutter_stripe` on the client to confirm the payment.

**Errors**: `404` Passenger not found, `400` Already paid

---

### POST `/payments/webhook`
**Public (Stripe only)** — Stripe webhook receiver. Signature verified via `STRIPE_WEBHOOK_SECRET`.

**Headers**: `stripe-signature: <sig>`

**Handled events**:
| Event | Action |
|---|---|
| `payment_intent.succeeded` | Mark ride CAPTURED or credit wallet |
| `payment_intent.payment_failed` | Mark ride FAILED |
| `payment_intent.canceled` | Mark ride CANCELLED |
| `charge.refund.updated` | Mark REFUNDED + credit wallet |
| `account.updated` | Log Connect account status |
| `transfer.failed` | Log transfer failure |

**Response `201`** `{ "received": true }`

---

### GET `/payments/history`
**Role: RIDER** — Paginated payment history.

**Response `200`**
```json
{
  "items": [
    {
      "id":        "uuid",
      "amount":    155.2,
      "currency":  "INR",
      "status":    "CAPTURED",
      "paymentMethod": "CARD",
      "createdAt": "2025-01-15T09:30:00Z"
    }
  ],
  "total": 7,
  "page":  1,
  "limit": 10
}
```

---

### POST `/payments/admin/:id/refund` *(Admin)*
**Role: ADMIN** — Issue a full or partial refund.

**Request**
```json
{
  "amountRupees": 50,
  "reason":       "Driver no-show"
}
```
> Omit `amountRupees` for a full refund.

**Response `200`**
```json
{ "refundAmount": 50, "currency": "INR" }
```

**Errors**: `404` Payment not found, `400` Not captured / no charge ID

---

### GET `/payments/admin/all` *(Admin)*
**Role: ADMIN** — List all payments.

**Query**: `page`, `limit`, `status` (`PENDING` | `CAPTURED` | `FAILED` | `REFUNDED`)

---

## Wallet

### GET `/payments/wallet/balance`
**Requires auth** — Get current wallet balance.

**Response `200`**
```json
{
  "balancePaise":   15000,
  "balanceDecimal": 150,
  "currency":       "INR"
}
```

---

### POST `/payments/wallet/topup`
**Requires auth** — Initiate a wallet top-up via Stripe (₹10 – ₹50,000).

**Request**
```json
{ "amountRupees": 500 }
```

**Response `201`**
```json
{
  "clientSecret":    "pi_xxx_secret_xxx",
  "paymentIntentId": "pi_xxx",
  "walletId":        "uuid"
}
```

**Errors**: `400` Amount out of range, `400` Wallet frozen

---

### GET `/payments/wallet/transactions`
**Requires auth** — Paginated wallet transaction ledger.

**Response `200`**
```json
{
  "items": [
    {
      "id":               "uuid",
      "type":             "TOPUP",
      "amountPaise":      50000,
      "balanceAfterPaise": 65000,
      "description":      "Wallet top-up via Stripe",
      "createdAt":        "2025-01-15T10:00:00Z"
    }
  ],
  "total": 3
}
```

Transaction types: `TOPUP` | `RIDE_DEBIT` | `REFUND_CREDIT` | `CASHBACK` | `PAYOUT` | `ADJUSTMENT`

---

## Driver Connect / Payouts

### POST `/payments/connect/onboard`
**Role: DRIVER** — Initiate Stripe Connect Express account onboarding.

**Request**
```json
{ "baseUrl": "https://taxipool.app" }
```

**Response `201`**
```json
{
  "accountId":    "acct_xxx",
  "onboardingUrl": "https://connect.stripe.com/setup/e/..."
}
```

Driver should be redirected to `onboardingUrl` to complete KYC with Stripe.

---

### GET `/payments/connect/status`
**Role: DRIVER** — Check Connect account readiness.

**Response `200`**
```json
{
  "accountId":        "acct_xxx",
  "chargesEnabled":   true,
  "detailsSubmitted": true,
  "payoutsEnabled":   true
}
```

---

### GET `/payments/payouts/mine`
**Role: DRIVER** — Payout history.

---

### GET `/payments/payouts/mine/summary`
**Role: DRIVER** — Earnings summary + current commission tier.

**Response `200`**
```json
{
  "totalPaid":       12400.50,
  "totalCommission":  2480.10,
  "totalGross":      14880.60,
  "pendingCount":     0,
  "commissionTier":  "Silver",
  "monthlyTrips":    45
}
```

---

### POST `/payments/admin/payouts/driver/:driverId` *(Admin)*
**Role: ADMIN** — Manually trigger a payout for a specific date range.

**Request**
```json
{
  "periodStart": "2025-01-01",
  "periodEnd":   "2025-01-07"
}
```

---

### POST `/payments/admin/payouts/retry-failed` *(Admin)*
**Role: ADMIN** — Retry all FAILED payouts.

**Response `200`**
```json
{ "retried": 3, "succeeded": 2 }
```

---

### GET `/payments/admin/payouts` *(Admin)*
**Role: ADMIN** — List all driver payouts.

**Query**: `page`, `limit`, `status` (`PENDING` | `PROCESSING` | `PAID` | `FAILED`)

---

### GET `/payments/admin/payouts/driver/:driverId/summary` *(Admin)*
**Role: ADMIN** — Earnings summary for any driver.

---

## Admin

All `/admin/*` endpoints require **ADMIN** role.

### GET `/admin/dashboard`
KPI metrics for the dashboard.

**Response `200`**
```json
{
  "totalUsers":       1240,
  "totalDrivers":      87,
  "activeTrips":        12,
  "todayRevenue":    24500,
  "weekRevenue":    162000,
  "avgRating":         4.7,
  "completionRate":   92.3,
  "pendingApprovals":   5
}
```

---

### GET `/admin/trips`
All trips (paginated). **Query**: `page`, `limit`

---

### GET `/admin/drivers/pending`
Drivers awaiting approval. **Query**: `page`, `limit`

---

### PATCH `/admin/drivers/:id/approve`
Approve a driver application.

**Response `200`** — Updated driver profile.

---

### PATCH `/admin/drivers/:id/reject`
Reject a driver application.

**Request**
```json
{ "reason": "Document mismatch" }
```

---

### PATCH `/admin/users/:id/suspend`
Suspend user (temporary, reversible).

---

### PATCH `/admin/users/:id/ban`
Ban user permanently.

---

### PATCH `/admin/users/:id/reinstate`
Reinstate a suspended or banned user.

---

### GET `/admin/reports/revenue`
Revenue report between two dates.

**Query**: `from=2025-01-01&to=2025-01-31`

**Response `200`**
```json
{
  "totalRevenue":     162000,
  "totalCommission":   36450,
  "totalPayouts":     125550,
  "tripCount":          892,
  "avgFarePerTrip":   181.6,
  "daily": [
    { "date": "2025-01-01", "revenue": 5200, "trips": 28 }
  ]
}
```

---

## WebSocket API

**Connect**: `wss://api.taxipool.app?token=<accessToken>`

Authentication happens on connection. Invalid tokens cause an immediate disconnect.

### Client → Server events

| Event | Payload | Who |
|---|---|---|
| `driver:location` | `{ lat, lng, heading?, speed? }` | DRIVER |
| `driver:online` | `{}` | DRIVER |
| `driver:offline` | `{}` | DRIVER |
| `trip:accept` | `{ tripId }` | DRIVER |
| `trip:decline` | `{ tripId, reason? }` | DRIVER |
| `trip:arrived` | `{ tripId }` | DRIVER |
| `trip:pickup` | `{ tripId }` | DRIVER |
| `trip:dropoff` | `{ tripId }` | DRIVER |
| `trip:join_room` | `{ tripId }` | Any |

### Server → Client events

| Event | Payload | Recipients |
|---|---|---|
| `trip:matched` | `{ tripId, driver: { name, phone, vehicle, lat, lng } }` | RIDER |
| `trip:driver_location` | `{ lat, lng, heading?, speed? }` | Riders in trip room |
| `trip:status_changed` | `{ tripId, status, timestamp }` | Trip room |
| `trip:completed` | `{ tripId, fareAmount, distanceKm, durationMin }` | Trip room |
| `trip:cancelled` | `{ tripId, reason? }` | Trip room |
| `trip:no_driver` | `{ tripId }` | RIDER |
| `notification` | `{ title, body, type, data }` | Individual user |

---

## Common Error Codes

| Status | Meaning |
|---|---|
| `400` | Validation error or bad request |
| `401` | Missing or invalid JWT |
| `403` | Authenticated but wrong role |
| `404` | Resource not found |
| `409` | Conflict (e.g. duplicate resource) |
| `422` | Business logic violation (e.g. invalid FSM transition) |
| `429` | Rate limit exceeded |
| `500` | Internal server error |

---

## Pagination

All list endpoints accept:

| Query param | Default | Description |
|---|---|---|
| `page` | `1` | Page number (1-indexed) |
| `limit` | `20` | Items per page (max 100) |

Response shape:
```json
{
  "items": [...],
  "total": 240,
  "page":  1,
  "limit": 20,
  "pages": 12
}
```
