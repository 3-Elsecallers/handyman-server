# Payment Service

---

## Overview

The Payment Service handles all financial transactions: customer payments via Paystack, provider payouts, refunds, and tip processing. It has its own private database (`payment_db`). It is the only service that interacts with the Paystack API.

---

## Responsibilities

- Paystack transaction initialization and verification
- Customer payment flow (initialize, verify, capture)
- Provider Paystack subaccount setup
- Platform fee calculation and deduction
- Provider payout scheduling and execution
- Tip processing
- Full and partial refund handling
- Invoice/receipt generation
- Webhook processing from Paystack

---

## Database

Private PostgreSQL database: `payment_db`

### Prisma Schema

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum PaymentStatus {
  pending
  authorized
  paid
  refunded
  failed
}

model Payment {
  id                 String        @id @default(uuid())
  bookingId          String        @unique
  paystackRef        String?       @unique
  paystackAccessCode String?
  amount             Float
  platformFee        Float
  providerEarning    Float
  tipAmount          Float         @default(0)
  status             PaymentStatus @default(pending)
  refundedAmount     Float         @default(0)
  refundReason       String?
  createdAt          DateTime      @default(now())
  updatedAt          DateTime      @updatedAt

  @@index([bookingId])
  @@index([status])
  @@index([paystackRef])
}
```

**Note**: `Payment.bookingId` is a UUID referencing the Booking Service's database. No foreign key constraint. The Payment Service receives booking context via Kafka events and internal API calls.

---

## Core Functionality

### Paystack Integration

#### Provider Subaccount Setup

1. Provider initiates onboarding via Provider Service
2. Payment Service creates a Paystack subaccount
3. Split configured: platform percentage + provider percentage
4. Provider completes KYC via Paystack

#### Payment Flow

**Step 1: Initialize Transaction** (triggered by `booking.created` Kafka event)

1. Receive booking details from Kafka
2. Calculate platform fee: `percentage_fee x amount + flat_fee`
3. Initialize Paystack transaction with split payment config
4. Create `Payment` record with status `pending`
5. Return `access_code` to client for checkout

**Step 2: Verify Transaction** (after customer completes checkout)

1. Client returns with `trxref` parameter
2. Payment Service verifies with Paystack API
3. On success: `Payment.status` -> `paid`, publish `payment.captured`
4. On failure: `Payment.status` -> `failed`

**Step 3: Webhook Confirmation**

1. Receive Paystack webhook (`charge.success`, `transfer.success`, `refund.processed`)
2. Verify webhook signature
3. Process accordingly

#### Split Payment Model

```
Customer pays: $165.00
  +---> Platform fee: $24.75 (15%)
  +---> Provider earning: $140.25 (85%)
```

- Platform fee: configurable (default 15%)
- Tips: 100% to provider (no platform fee)

### Payout Scheduling

- Via Paystack transfer API
- Schedule: daily, weekly, or bi-weekly per provider
- Minimum payout threshold: $25

### Refund Flow

**Full Refund:**
1. Admin or customer initiates
2. Paystack refund API called
3. Amount: `payment.amount - payment.tipAmount`
4. `Payment.status` -> `refunded`
5. Publish `payment.refunded`

**Partial Refund:**
1. Admin determines amount
2. Partial refund via Paystack
3. Provider earning adjusted

### Tip Processing

- Customer adds tip after completion (up to 50% of service amount)
- Tip via Paystack additional charge
- 100% to provider
- Window: 48 hours after completion

---

## Internal API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| POST | `/internal/payments/initialize` | Initialize transaction |
| POST | `/internal/payments/:id/verify` | Verify transaction |
| POST | `/internal/payments/:id/refund` | Process refund |
| GET | `/internal/payments/booking/:bookingId` | Get payment for booking |

### Response Schema

#### GET `/internal/payments/booking/:bookingId`

```json
{
  "id": "uuid",
  "bookingId": "uuid",
  "amount": 165.00,
  "platformFee": 24.75,
  "providerEarning": 140.25,
  "tipAmount": 0,
  "status": "paid",
  "paystackRef": "txn_xxx",
  "createdAt": "2026-03-10T14:30:00Z"
}
```

---

## Client-Facing APIs

### Customer Routes

| Method | Endpoint | Description |
|---|---|---|
| GET | `/payments/:id` | Payment details |
| GET | `/customers/payments` | Payment history |
| POST | `/payments/:id/tip` | Add tip |
| GET | `/payments/:id/invoice` | Download invoice |

### Provider Routes

| Method | Endpoint | Description |
|---|---|---|
| GET | `/providers/me/earnings` | Earnings dashboard |
| GET | `/providers/me/payouts` | Payout history |

### Webhook Route

| Method | Endpoint | Description |
|---|---|---|
| POST | `/webhooks/paystack` | Paystack webhook receiver |

### Admin Routes

| Method | Endpoint | Description |
|---|---|---|
| GET | `/admin/payments` | All transactions |
| POST | `/admin/payments/:id/refund` | Process refund |

---

## Kafka Topics Published

| Topic | Key | Payload |
|---|---|---|
| `payment.captured` | paymentId | `{ paymentId, bookingId, amount, providerEarning }` |
| `payment.refunded` | paymentId | `{ paymentId, bookingId, refundAmount, reason }` |
| `payment.payout.completed` | paymentId | `{ providerId, amount, paystackTransferRef }` |

## Kafka Topics Consumed

| Topic | Purpose |
|---|---|
| `booking.created` | Initialize payment transaction |
| `booking.completed` | Trigger capture if not already |
| `booking.cancelled` | Trigger refund |
| `booking.disputed` | Hold payout, flag for review |

---

## Dependencies

| Dependency | Purpose | How Accessed |
|---|---|---|
| Booking Service | Booking context (amount, provider) | Internal API (`GET /internal/bookings/:id`) |
| Paystack API | Payment processing, payouts, refunds | External HTTP API |
| S3 | Invoice storage | AWS SDK |
| Communication Service | Payment confirmations | Kafka events (produced) |

---

## Data It Does NOT Own

| Data | Owner | How Payment Service Accesses It |
|---|---|---|
| Booking details | Booking Service | Kafka events + internal API |
| Provider Paystack account | Provider Service | Kafka events (for payout config) |
| User contact info | Identity Service | Not accessed (Communication Service handles notifications) |

---

## Key Data Flow

```
Booking Svc       Kafka         Payment Service       Paystack API       S3
  |                |                  |                     |               |
  |-- booking.created -------------->|                     |               |
  |                |                  |-- initialize tx --->|               |
  |                |                  |<- access_code ------|               |
  |                |                  |                     |               |
  |                |                  | (customer completes checkout)       |
  |                |                  |                     |               |
  |                |                  |-- verify tx ------->|               |
  |                |                  |<- verified ---------|               |
  |                |                  |                     |               |
  |                |                  |-- generate invoice --------------->|
  |                |                  |                     |               |
  |                |-- payment.captured -->|                |               |
  |                |                  |                     |               |
  |                |                  | (payout schedule)   |               |
  |                |                  |-- transfer -------->|               |
  |                |                  |<- success ----------|               |
```
