# Booking Service

---

## Overview

The Booking Service owns the complete booking lifecycle: creation, status transitions, scheduling, pricing calculation, and cancellation/dispute workflows. It has its own private database (`booking_db`). It orchestrates between customers, providers, and the Payment Service by calling their internal APIs.

---

## Responsibilities

- Booking creation (instant and request-based)
- Booking status state machine
- Provider accept/decline workflow
- Pricing engine (price quote calculation)
- Cancellation policy enforcement
- Dispute initiation
- Recurring booking scheduling
- Booking history retrieval
- Promo code validation and usage tracking

---

## Database

Private PostgreSQL database: `booking_db`

### Prisma Schema

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum BookingStatus {
  pending
  confirmed
  in_progress
  completed
  cancelled
  disputed
}

model Booking {
  id              String        @id @default(uuid())
  customerId      String
  providerId      String
  serviceId       String
  status          BookingStatus @default(pending)
  scheduledAt     DateTime
  completedAt     DateTime?
  locationLine1   String
  locationLine2   String?
  locationCity    String
  locationState   String
  locationPostal  String
  locationLat     Float
  locationLng     Float
  priceQuote      Float
  complexity      String        @default("standard")
  notes           String?
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt

  @@index([customerId, status])
  @@index([providerId, status])
  @@index([scheduledAt])
  @@index([status])
}

model PromoCode {
  id          String    @id @default(uuid())
  code        String    @unique
  description String?
  discountPct Float?
  discountAmt Float?
  maxUses     Int?
  usedCount   Int       @default(0)
  expiresAt   DateTime?
  isActive    Boolean   @default(true)
  createdAt   DateTime  @default(now())

  usages PromoUsage[]

  @@index([code])
}

model PromoUsage {
  id          String   @id @default(uuid())
  promoCodeId String
  userId      String
  bookingId   String?
  createdAt   DateTime @default(now())

  promoCode PromoCode @relation(fields: [promoCodeId], references: [id])

  @@index([promoCodeId])
}
```

**Note**: `Booking.customerId`, `Booking.providerId`, and `Booking.serviceId` are UUIDs referencing data in Identity, Provider, and Payment Service databases respectively. No foreign key constraints across databases. The Booking Service resolves these IDs via internal API calls when creating bookings.

---

## Core Functionality

### Pricing Engine

Computed synchronously at booking creation:

```
final_price = base_price
            x complexity_multiplier
            + travel_fee(distance)
            + time_of_day_surge(hour, day)
            - promo_discount
```

| Component | Source | Logic |
|---|---|---|
| `base_price` | Provider Service (`GET /internal/services/:id`) | Provider custom price or base price |
| `complexity_multiplier` | Customer input | standard=1.0, moderate=1.2, complex=1.5 |
| `travel_fee` | Distance calc | $X/km beyond free radius |
| `time_of_day_surge` | Scheduled time | +10% evening, +15% weekend, +25% holiday |
| `promo_discount` | `PromoCode` table | Percentage or flat discount |

### Booking Creation - Instant

1. Customer submits: serviceId, providerId, scheduledTime, address, complexity
2. **Call Provider Service**: `GET /internal/services/:id` to get pricing
3. **Call Provider Service**: `POST /internal/providers/:id/availability/validate` to check slot
4. Compute price quote via pricing engine
5. Validate and apply promo code if provided
6. Create `Booking` with status `pending`
7. Publish `booking.created` to Kafka
8. Provider accepts -> status `confirmed` -> publish `booking.confirmed`
9. Provider declines or 24h timeout -> auto-cancel

### Booking Creation - Request-Based

1. Customer submits: serviceId, description, scheduledWindow, address
2. **Call Provider Service**: `POST /internal/providers/match` to find candidates
3. Requests sent to top 3-5 providers
4. First to accept within 30 min gets the booking
5. If no acceptance -> expand or auto-cancel

### State Machine

```
                  +--------------+
                  |    pending    |
                  +------+-------+
                         | provider confirms
                         v
                  +--------------+
         +-------|  confirmed   |-------+
         |       +------+-------+       |
         |              | provider      | customer/
         |              | starts        | provider cancels
         |              v               |
         |       +--------------+       |
         |       | in_progress  |       |
         |       +------+-------+       |
         |              | completed     |
         |              v               v
         |       +--------------+ +--------------+
         |       |  completed   | |  cancelled   |
         |       +--------------+ +--------------+
         |                                    ^
         | dispute                            |
         v                                    |
  +--------------+                           |
  |   disputed   |---------------------------+
  +--------------+  (admin resolves)
```

### Cancellation Policy

| Scenario | Outcome |
|---|---|
| Customer cancels 24+ hours before | Full refund, no penalty |
| Customer cancels less than 24h | 50% charge, provider compensated |
| Provider cancels 24+ hours before | Warning, booking reassigned |
| Provider cancels less than 24h | Provider penalized |
| No-show after 30 min | Auto-cancel, penalties applied |

---

## Internal API Endpoints

Called by other services (service-to-service token auth).

| Method | Endpoint | Description |
|---|---|---|
| GET | `/internal/bookings/:id` | Booking detail |
| GET | `/internal/bookings/customer/:id` | Customer's bookings |
| GET | `/internal/bookings/provider/:id` | Provider's bookings |

### Response Schema

#### GET `/internal/bookings/:id`

```json
{
  "id": "uuid",
  "customerId": "uuid",
  "providerId": "uuid",
  "serviceId": "uuid",
  "status": "confirmed",
  "scheduledAt": "2026-03-15T10:00:00Z",
  "priceQuote": 165.00,
  "locationCity": "Austin",
  "locationState": "TX",
  "createdAt": "2026-03-10T14:30:00Z"
}
```

---

## Client-Facing APIs

### Customer Routes

| Method | Endpoint | Description |
|---|---|---|
| POST | `/bookings` | Create booking |
| GET | `/bookings/:id` | Booking detail |
| PUT | `/bookings/:id/cancel` | Cancel |
| POST | `/bookings/:id/dispute` | Open dispute |
| GET | `/customers/bookings` | List bookings |
| GET | `/bookings/:id/timeline` | Status history |

### Provider Routes

| Method | Endpoint | Description |
|---|---|---|
| GET | `/bookings/:id` | Booking detail |
| PUT | `/bookings/:id/confirm` | Accept |
| PUT | `/bookings/:id/decline` | Decline |
| PUT | `/bookings/:id/start` | Mark in-progress |
| PUT | `/bookings/:id/complete` | Mark completed |
| PUT | `/bookings/:id/cancel` | Cancel |
| GET | `/providers/me/bookings` | List own bookings |

### Admin Routes

| Method | Endpoint | Description |
|---|---|---|
| GET | `/admin/bookings` | All bookings |
| PUT | `/admin/bookings/:id/resolve` | Resolve dispute |
| POST/GET/PUT | `/admin/promos/*` | Promo code management |

---

## Kafka Topics Published

| Topic | Key | Payload |
|---|---|---|
| `booking.created` | bookingId | `{ bookingId, customerId, providerId, serviceId, scheduledAt, priceQuote }` |
| `booking.confirmed` | bookingId | `{ bookingId, customerId, providerId, scheduledAt }` |
| `booking.started` | bookingId | `{ bookingId, customerId, providerId }` |
| `booking.completed` | bookingId | `{ bookingId, customerId, providerId, serviceId, priceQuote }` |
| `booking.cancelled` | bookingId | `{ bookingId, cancelledBy, reason, refundAmount }` |
| `booking.disputed` | bookingId | `{ bookingId, customerId, reason }` |

## Kafka Topics Consumed

| Topic | Purpose |
|---|---|
| `payment.captured` | Confirm payment received |
| `payment.refunded` | Update booking with refund status |
| `provider.availability.changed` | Revalidate pending bookings |

---

## Dependencies

| Dependency | Purpose | How Accessed |
|---|---|---|
| Identity Service | User info (name, email) for display | Internal API |
| Provider Service | Provider profile, availability, services, matching | Internal API |
| Payment Service | Payment status confirmation | Kafka events |
| Communication Service | Notifications on status changes | Kafka events (produced) |
| Redis | Booking locks, rate limiting | Shared Redis instance |

---

## Data It Does NOT Own

| Data | Owner | How Booking Service Accesses It |
|---|---|---|
| User name, email | Identity Service | Internal API (`GET /internal/users/:id`) |
| Provider profile, availability | Provider Service | Internal API (`GET /internal/providers/:id`, `POST /internal/providers/:id/availability/validate`) |
| Service pricing | Provider Service | Internal API (`GET /internal/services/:id`) |
| Payment status | Payment Service | Kafka events |

---

## Key Data Flow

```
Customer         Booking Service       Identity Svc      Provider Svc      Payment Svc
  |                    |                     |                |                 |
  |-- POST /bookings ->|                     |                |                 |
  |                    |-- GET /internal/users/:id --------->|                 |
  |                    |-- GET /internal/services/:id ------>|                 |
  |                    |-- POST /internal/providers/:id/availability/validate ->|
  |                    |<- { available: true } --------------|                 |
  |                    |<- { pricing } ----------------------|                 |
  |                    |                     |                |                 |
  |                    |-- compute price     |                |                 |
  |                    |-- create booking    |                |                 |
  |                    |-- publish booking.created ---------------------------->|
  |<-- { booking } ----|                     |                |                 |
  |                    |                     |                |                 |
  |                    |<- PUT /:id/confirm (provider) ------|                 |
  |                    |-- publish booking.confirmed -------->|                 |
  |                    |                     |                |                 |
  |                    |    ... service performed ...         |                 |
  |                    |                     |                |                 |
  |                    |<- PUT /:id/complete (provider) -----|                 |
  |                    |-- publish booking.completed -------->|                 |
```
