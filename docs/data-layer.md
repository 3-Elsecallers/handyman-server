# Data Layer — Infrastructure Overview

---

## Overview

Each microservice owns a **private PostgreSQL database**. No service connects to another service's database. Cross-service data access happens exclusively through internal REST APIs (synchronous) or Kafka events (asynchronous). This ensures loose coupling and independent deployability.

---

## Database Instances

| Service | Database | Extensions | Notes |
|---|---|---|---|
| Identity Service | `identity_db` | — | Users, auth, addresses |
| Provider Service | `provider_db` | PostGIS | Provider data, catalog, search, reviews |
| Booking Service | `booking_db` | — | Bookings, promo codes |
| Payment Service | `payment_db` | — | Paystack transactions, payouts |
| Communication Service | `comm_db` | — | Messages, notifications |

Each database is a separate PostgreSQL instance (or separate logical database on a shared cluster for MVP). Schemas are defined independently per service via Prisma.

---

## Redis

Redis is shared infrastructure used by all services for different purposes:

| Key Pattern | Owner | Purpose | TTL |
|---|---|---|---|
| `session:{userId}` | Identity | Active session | 15 min |
| `refresh:{hash}` | Identity | Refresh token metadata | 7d |
| `rate:{key}` | Gateway | Rate limiting (sliding window) | 1 min |
| `ws:user:{userId}` | Communication | WebSocket instance mapping | 30s heartbeat |
| `booking:lock:{id}` | Booking | Prevent double-accept | 30s |
| `search:cache:{hash}` | Provider | Cached search results | 5 min |
| `autocomplete:{prefix}` | Provider | Autocomplete suggestions | 5 min |
| `device:{userId}` | Communication | Push device tokens | — |
| `matching:config` | Provider | Algorithm weight config | — |
| `bull:*` | All | BullMQ job queues | — |

---

## Kafka

Kafka is the central event bus. Each service runs its own consumer groups. No service reads another service's database directly.

### Topic Design Principles

1. **Event-carried state transfer**: Events carry enough data for consumers to update local projections without calling back to the publisher
2. **Idempotent consumers**: All consumers handle duplicate delivery gracefully
3. **Schema evolution**: Events use JSON with versioned schemas (backward compatible)
4. **Retention**: Critical events (payments, disputes) retained 90 days; ephemeral events (typing) retained 7 days

### Topic Map

See [architecture-overview.md](./architecture-overview.md) for the full topic map.

---

## S3 Buckets

| Bucket | Owner | Contents |
|---|---|---|
| `handyman-avatars` | Identity | User profile photos |
| `handyman-documents` | Provider | Verification documents (ID, selfie) |
| `handyman-reviews` | Provider | Review photos |
| `handyman-messages` | Communication | Chat image attachments |
| `handyman-invoices` | Payment | Generated invoice PDFs |

---

## Cross-Service Data Access Patterns

### Pattern 1: Internal REST API (Sync)

Used when a service needs data in real-time to complete a request.

```
Booking Service                     Provider Service
     │                                    │
     ├─ GET /internal/providers/:id ─────►│
     │                                    │
     │◄── { profile, availability } ──────│
     │                                    │
```

**When to use**: Request-response flow where the caller cannot proceed without the data (e.g., booking creation needs provider availability).

### Pattern 2: Kafka Event + Local Projection (Async)

Used when a service needs a read-optimized copy of another service's data for queries.

```
Identity Service         Kafka           Provider Service
     │                     │                     │
     ├─ publish identity.user.updated ──►│       │
     │                     │             ├─ update local user_cache
     │                     │             │
     │                     │             │ (later query uses local cache)
```

**When to use**: The service needs to query or display data frequently but doesn't need it in real-time (e.g., Provider Service caching user names for search results).

### Pattern 3: Kafka Event + On-Demand Fetch (Hybrid)

Used when a service receives an event and needs full context.

```
Payment Service          Kafka          Booking Service
     │                     │                    │
     │◄── booking.completed ──│                 │
     │                     │                    │
     ├─ GET /internal/bookings/:id ────────────►│
     │                     │                    │
     │◄── { booking details } ─────────────────│
```

**When to use**: The event triggers an action that requires full data context (e.g., payment capture needs booking amount and provider info).

---

## Migration Strategy

- Each service manages its own migrations independently via Prisma Migrate
- No cross-service foreign keys (by design)
- Schema changes in one service do not require coordinated deployments
- Data consistency across services is eventual, not immediate

---

## Backup & Recovery

| Component | Strategy | RPO | RTO |
|---|---|---|---|
| PostgreSQL (each) | Automated daily snapshots + WAL archiving | 5 min | 1 hour |
| Redis | RDB snapshots every 15 min | 15 min | 30 min |
| S3 | Versioning + cross-region replication | 0 (versioned) | Near-zero |
| Kafka | Replication factor 3, min.insync.replicas 2 | 0 | Minutes |
