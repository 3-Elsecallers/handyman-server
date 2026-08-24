# Handyman — Lean Microservices Architecture

---

## Architecture Summary

The system is organized into **5 domain services** behind an **API Gateway**. Each service owns a **private database** and exposes data to other services exclusively through internal REST APIs or Kafka events. Services are loosely coupled with no shared database access.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT LAYER                                   │
│   ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────────┐ │
│   │   Mobile App     │  │   Web App        │  │     Admin Dashboard      │ │
│   │  (React Native)  │  │   (React/Vite)   │  │      (React/Vite)        │ │
│   └────────┬─────────┘  └────────┬─────────┘  └────────────┬─────────────┘ │
└────────────┼──────────────────────┼─────────────────────────┼───────────────┘
             └──────────────────────┼─────────────────────────┘
                                    │ HTTPS / WSS
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           API GATEWAY                                       │
│         Routing · Rate Limiting · JWT Validation · Request Shaping          │
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │
     ┌───────────────┬───────────┼───────────┬────────────────┐
     ▼               ▼           ▼           ▼                ▼
┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
│ Identity │  │ Provider │  │ Booking  │  │ Payment  │  │  Comm.   │
│ Service  │  │ Service  │  │ Service  │  │ Service  │  │ Service  │
└────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘
     │              │             │              │              │
     ▼              ▼             ▼              ▼              ▼
┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
│ identity │  │ provider │  │ booking  │  │ payment  │  │  comm    │
│    db    │  │    db    │  │    db    │  │    db    │  │    db    │
└──────────┘  └──────────┘  └──────────┘  └──────────┘  └──────────┘

     ╔══════════════════════════════════════════════════════════════╗
     ║  Each service has a PRIVATE database. No direct DB access   ║
     ║  between services. Cross-service data via REST or Kafka.    ║
     ╚══════════════════════════════════════════════════════════════╝

     ──────────────────── Kafka (async events) ────────────────────
     ──────────────────── Internal REST (sync)  ───────────────────
```

---

## Service Inventory

| # | Service | Private DB | Boundaries |
|---|---------|-----------|------------|
| 1 | **API Gateway** | — (stateless) | Routing, auth validation, rate limiting |
| 2 | **Identity Service** | `identity_db` | Auth, user profiles, addresses, favorites |
| 3 | **Provider Service** | `provider_db` | Provider profiles, catalog, search, matching, reviews |
| 4 | **Booking Service** | `booking_db` | Booking lifecycle, pricing engine, scheduling |
| 5 | **Payment Service** | `payment_db` | Paystack integration, payouts, refunds |
| 6 | **Communication Service** | `comm_db` | Real-time messaging, push/email/SMS notifications |

**Admin** is not a separate service. Admin endpoints live on each domain service behind admin-role authorization.

---

## Database-Per-Service Pattern

Each service owns its database exclusively. No service connects to another service's database.

```
Identity Service ──► identity_db (PostgreSQL)
Provider Service  ──► provider_db  (PostgreSQL + PostGIS)
Booking Service   ──► booking_db   (PostgreSQL)
Payment Service   ──► payment_db   (PostgreSQL)
Communication Svc ──► comm_db      (PostgreSQL)
```

### Cross-Service Data Access

When a service needs data it does not own, it calls an internal API on the owning service:

| Caller | Needs | Calls | Endpoint |
|---|---|---|---|
| API Gateway | Validate JWT, resolve user | Identity | `GET /internal/users/:id` |
| Booking Service | Provider profile, availability, services | Provider | `GET /internal/providers/:id` |
| Booking Service | Provider availability check | Provider | `POST /internal/providers/:id/availability/validate` |
| Booking Service | Service pricing | Provider | `GET /internal/services/:id` |
| Communication Service | User contact info, notification prefs | Identity | `GET /internal/users/:id` |
| Communication Service | Booking context | Booking | `GET /internal/bookings/:id` |
| Payment Service | Booking context (amount, provider) | Booking | `GET /internal/bookings/:id` |
| Provider Service | User info for provider profile | Identity | `GET /internal/users/:id` |

### Event-Driven Data Projection

Some services maintain read-optimized projections of data from other services, built from Kafka events:

| Service | Projects | Source Event | Purpose |
|---|---|---|---|
| Provider Service | Search index | `identity.user.updated` | Display customer info in booking context |
| Booking Service | Provider snapshot | `provider.profile.updated` | Cache provider info at booking time |
| Communication Service | User contact cache | `identity.user.registered` | Fast lookup for notification delivery |

These projections are eventually consistent and rebuilt from events. They serve as local read caches, not authoritative sources.

---

## Consolidation Rationale

| Merged Into | Services Absorbed | Why |
|---|---|---|
| **Identity Service** | Auth + User | Auth creates users; User manages profiles. Same JWT, same lifecycle. |
| **Provider Service** | Provider + Catalog + Search + Matching + Reviews | All facets of the "provider" domain. Search indexes provider data. Matching queries it. Reviews affect ratings. |
| **Booking Service** | Booking + Pricing | Pricing is invoked synchronously at booking creation. Splitting adds a network hop for no benefit. |
| **Communication Service** | Messaging + Notifications | Both deliver messages to users. Different channels, same responsibility. |

---

## Communication Patterns

### Synchronous (Internal REST)

Service-to-service calls for real-time data needs. All internal endpoints are prefixed with `/internal/` and authenticated via service-to-service tokens.

```
Service A ──[service token]──► Service B  (internal REST)
```

### Asynchronous (Kafka)

All domain events flow through Kafka. Services publish events and consume from topics they subscribe to. No direct event delivery between services.

```
Service A ──publish──► Kafka topic ──consume──► Service B
```

---

## Kafka Topic Map

| Topic | Publisher | Consumers | Trigger |
|---|---|---|---|
| `identity.user.registered` | Identity | Provider, Communication | New user created |
| `identity.user.updated` | Identity | Provider | Profile changed |
| `identity.user.suspended` | Identity | Booking, Payment, Communication | Account suspended |
| `provider.profile.updated` | Provider | Booking (cache refresh) | Profile changed |
| `provider.availability.changed` | Provider | Booking | Schedule changed |
| `provider.verified` | Provider | Communication | Verification approved |
| `provider.review.submitted` | Provider | Communication, Booking (stats) | New review |
| `catalog.service.created` | Provider | Booking (cache refresh) | New service added |
| `booking.created` | Booking | Payment, Communication, Provider | New booking |
| `booking.confirmed` | Booking | Payment, Communication | Provider accepted |
| `booking.started` | Booking | Communication | Service begun |
| `booking.completed` | Booking | Payment, Provider, Communication | Service finished |
| `booking.cancelled` | Booking | Payment, Communication, Provider | Booking cancelled |
| `booking.disputed` | Booking | Communication | Dispute opened |
| `payment.captured` | Payment | Booking, Communication | Payment received |
| `payment.refunded` | Payment | Booking, Communication | Refund processed |
| `payment.payout.completed` | Payment | Communication | Provider paid |
| `message.sent` | Communication | Communication (fanout) | Chat message |

---

## Infrastructure

| Component | Technology |
|---|---|
| API Gateway | Fastify with middleware |
| Services | Node.js + TypeScript (Fastify) |
| Database | PostgreSQL + PostGIS (one instance per service) |
| Cache / Pub-Sub | Redis (sessions, rate limiting, WebSocket fanout, BullMQ) |
| Message Broker | Apache Kafka (kafkajs) |
| Object Storage | AWS S3 (avatars, documents, invoices, images) |
| Push Notifications | Firebase Cloud Messaging (FCM) |
| Email | Resend / AWS SES |
| SMS | Twilio |
| Payments | Paystack |
| Search | PostgreSQL full-text + PostGIS (MVP) |

---

## Service Documentation

| Document | Description |
|---|---|
| [data-layer.md](./data-layer.md) | Infrastructure overview: databases, Redis, Kafka, S3 |
| [api-gateway.md](./api-gateway.md) | Gateway routing, auth, rate limiting |
| [identity-service.md](./identity-service.md) | Auth, users, addresses, favorites |
| [provider-service.md](./provider-service.md) | Providers, catalog, search, matching, reviews |
| [booking-service.md](./booking-service.md) | Bookings, pricing, scheduling |
| [payment-service.md](./payment-service.md) | Paystack integration, payouts, refunds |
| [communication-service.md](./communication-service.md) | Messaging, notifications |
