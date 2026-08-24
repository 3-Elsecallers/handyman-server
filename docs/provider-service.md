# Provider Service

---

## Overview

The Provider Service owns everything related to providers: profiles, verification, availability, service catalog, search/discovery, matching, and reviews/ratings. It has its own private database (`provider_db`) with PostGIS extensions.

---

## Responsibilities

- Provider profile management (bio, location, service area, stats)
- Provider onboarding and verification workflow
- Paystack subaccount setup coordination
- Service category and service CRUD (catalog)
- Weekly availability schedule and blocked time management
- Provider search with full-text, geospatial, and faceted filtering
- Provider matching and ranking algorithm
- Review and rating submission, response, and moderation
- Provider stats maintenance

---

## Database

Private PostgreSQL database: `provider_db` with PostGIS extension.

### Prisma Schema

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum ProviderStatus {
  pending_review
  active
  suspended
  deactivated
}

enum ReviewStatus {
  visible
  flagged
  removed
}

model ProviderProfile {
  id                    String         @id @default(uuid())
  userId                String         @unique
  paystackAccountCode   String?
  bio                   String?
  avgRating             Float          @default(0)
  totalReviews          Int            @default(0)
  totalJobs             Int            @default(0)
  completionRate        Float          @default(1.0)
  avgResponseTimeMins   Int?
  verified              Boolean        @default(false)
  status                ProviderStatus @default(pending_review)
  serviceAreaRadiusKm   Float          @default(25)
  lat                   Float?
  lng                   Float?
  createdAt             DateTime       @default(now())
  updatedAt             DateTime       @updatedAt

  services      ProviderService[]
  availability  Availability[]
  blockedSlots  BlockedSlot[]
  reviews       Review[]

  @@index([userId])
  @@index([lat, lng])
  @@index([status])
}

model ProviderService {
  id          String   @id @default(uuid())
  providerId  String
  serviceId   String
  customPrice Float?
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())

  provider ProviderProfile @relation(fields: [providerId], references: [id], onDelete: Cascade)
  service  Service         @relation(fields: [serviceId], references: [id], onDelete: Cascade)

  @@unique([providerId, serviceId])
  @@index([serviceId])
}

model ServiceCategory {
  id          String   @id @default(uuid())
  name        String   @unique
  slug        String   @unique
  description String?
  iconUrl     String?
  sortOrder   Int      @default(0)
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())

  services Service[]

  @@index([slug])
}

model Service {
  id           String   @id @default(uuid())
  categoryId   String
  name         String
  slug         String   @unique
  description  String?
  basePrice    Float
  durationMins Int
  imageUrl     String?
  isActive     Boolean  @default(true)
  sortOrder    Int      @default(0)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  category         ServiceCategory   @relation(fields: [categoryId], references: [id])
  providerServices ProviderService[]

  @@index([categoryId])
  @@index([slug])
}

model Availability {
  id          String   @id @default(uuid())
  providerId  String
  dayOfWeek   Int
  startTime   String
  endTime     String
  isRecurring Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  provider ProviderProfile @relation(fields: [providerId], references: [id], onDelete: Cascade)

  @@index([providerId, dayOfWeek])
}

model BlockedSlot {
  id         String   @id @default(uuid())
  providerId String
  startAt    DateTime
  endAt      DateTime
  reason     String?
  createdAt  DateTime @default(now())

  provider ProviderProfile @relation(fields: [providerId], references: [id], onDelete: Cascade)

  @@index([providerId, startAt, endAt])
}

model Review {
  id               String       @id @default(uuid())
  bookingId        String       @unique
  customerId       String
  providerId       String
  rating           Int
  comment          String?
  photoUrls        String[]
  status           ReviewStatus @default(visible)
  providerResponse String?
  createdAt        DateTime     @default(now())
  updatedAt        DateTime     @updatedAt

  provider ProviderProfile @relation(fields: [providerId], references: [id])

  @@index([providerId, status])
  @@index([customerId])
}

model AuditLog {
  id         String   @id @default(uuid())
  actorId    String
  action     String
  targetType String
  targetId   String
  metadata   Json?
  createdAt  DateTime @default(now())

  @@index([actorId])
  @@index([targetType, targetId])
  @@index([createdAt])
}
```

**Note**: `Review.bookingId` and `Review.customerId` are UUIDs referencing data in other services' databases. No foreign key constraints across databases.

---

## Core Functionality

### Provider Onboarding

1. User registers with `role: provider` → Identity Service publishes `identity.user.registered`
2. Provider Service consumes event, creates `ProviderProfile` stub
3. Provider completes profile (bio, location, service area)
4. Provider selects services from catalog and optionally sets custom prices
5. Provider uploads verification documents to S3
6. Admin reviews verification → approves or rejects
7. On approval: `verified = true`, `status = active`
8. Provider sets up Paystack account (coordinated via Payment Service)

### Service Catalog

- `ServiceCategory` groups services (Cleaning, Plumbing, etc.)
- `Service` defines individual offerings with base price and duration
- Providers link to services via `ProviderService` with optional custom pricing
- Admin manages catalog CRUD

### Availability Management

- Providers set weekly recurring schedule (`Availability` table)
- Multiple time blocks per day
- `BlockedSlot` for one-off date ranges

### Search

Full-text + geospatial search across providers:

1. Proximity filter (PostGIS `ST_DWithin`)
2. Service/category filter
3. Price range filter
4. Rating minimum filter
5. Availability check
6. Verified filter
7. Relevance scoring
8. Favorites boost (1.3x for user's saved providers)
9. Pagination

### Matching Algorithm

```
score = (0.30 x proximity) +
        (0.25 x availability) +
        (0.20 x rating) +
        (0.10 x completionRate) +
        (0.10 x responseTime) +
        (0.05 x experience)
```

Weights stored in Redis for runtime tuning.

### Reviews

- One review per booking (bookingId is a UUID from Booking Service)
- Rating 1-5 + optional text + optional photos
- Provider can respond once
- Recency-weighted average for provider rating
- Reviews can be flagged and moderated by admin

---

## Internal API Endpoints

Called by other services (authenticated via service-to-service token).

| Method | Endpoint | Description |
|---|---|---|
| GET | `/internal/providers/:id` | Provider profile |
| GET | `/internal/providers/:id/services` | Service offerings with pricing |
| POST | `/internal/providers/:id/availability/validate` | Check if slot is available |
| POST | `/internal/providers/match` | Find matching providers for a booking request |
| GET | `/internal/services/:id` | Service detail (base price, duration) |
| GET | `/internal/services/categories` | List categories |

### Response Schemas

#### GET `/internal/providers/:id`

```json
{
  "id": "uuid",
  "userId": "uuid",
  "bio": "Professional cleaner...",
  "avgRating": 4.8,
  "totalReviews": 127,
  "totalJobs": 142,
  "completionRate": 0.96,
  "avgResponseTimeMins": 12,
  "verified": true,
  "status": "active",
  "serviceAreaRadiusKm": 25,
  "lat": 30.2672,
  "lng": -97.7431,
  "paystackAccountCode": "ACCT_xxx"
}
```

#### POST `/internal/providers/:id/availability/validate`

```json
// Request
{
  "scheduledAt": "2026-03-15T10:00:00Z",
  "durationMins": 180
}

// Response
{
  "available": true,
  "conflicts": []
}
```

#### POST `/internal/providers/match`

```json
// Request
{
  "serviceId": "uuid",
  "lat": 30.2672,
  "lng": -97.7431,
  "scheduledAt": "2026-03-15T10:00:00Z",
  "durationMins": 180,
  "limit": 5
}

// Response
{
  "matches": [
    {
      "providerId": "uuid",
      "userId": "uuid",
      "distanceKm": 3.2,
      "avgRating": 4.8,
      "score": 0.87,
      "availableSlots": ["2026-03-15T10:00:00Z"]
    }
  ]
}
```

---

## Client-Facing APIs

### Provider Routes

| Method | Endpoint | Description |
|---|---|---|
| GET | `/providers/me` | Own profile |
| PUT | `/providers/me` | Update profile |
| POST | `/providers/me/documents` | Upload verification docs |
| GET/POST/PUT/DELETE | `/providers/me/services/*` | Manage service offerings |
| GET/PUT | `/providers/me/availability` | Manage schedule |
| POST/DELETE | `/providers/me/blocked-slots/*` | Manage blocked time |
| GET | `/providers/me/dashboard` | Earnings & stats |

### Search Routes

| Method | Endpoint | Description |
|---|---|---|
| GET | `/search/providers` | Full search with filters |
| GET | `/search/providers/map` | Map viewport query |
| GET | `/search/autocomplete` | Autocomplete |

### Matching Routes

| Method | Endpoint | Description |
|---|---|---|
| POST | `/matching/find` | Find matching providers |

### Review Routes

| Method | Endpoint | Description |
|---|---|---|
| POST | `/bookings/:id/review` | Submit review |
| GET | `/providers/:id/reviews` | List provider reviews |
| POST | `/reviews/:id/respond` | Provider response |
| POST | `/reviews/:id/flag` | Flag review |

### Public Routes

| Method | Endpoint | Description |
|---|---|---|
| GET | `/providers/:id` | Public provider profile |
| GET | `/services/categories` | List categories |
| GET | `/services` | List services |
| GET | `/services/:slug` | Service detail |

### Admin Routes

| Method | Endpoint | Description |
|---|---|---|
| GET | `/admin/providers/verify` | Pending verification queue |
| PUT | `/admin/providers/:id/verify` | Approve/reject |
| POST/PUT | `/admin/services/*` | Catalog management |
| GET/PUT | `/admin/reviews/moderation` | Content moderation |
| GET | `/admin/audit-log` | Audit trail |

---

## Kafka Topics Published

| Topic | Key | Payload |
|---|---|---|
| `provider.profile.updated` | providerId | `{ providerId, fields }` |
| `provider.availability.changed` | providerId | `{ providerId, schedule }` |
| `provider.verified` | providerId | `{ providerId, adminId }` |
| `provider.review.submitted` | reviewId | `{ reviewId, providerId, rating, customerId, bookingId }` |
| `provider.stats.updated` | providerId | `{ providerId, avgRating, totalJobs, completionRate }` |
| `catalog.service.created` | serviceId | `{ serviceId, name, slug, categoryId, basePrice }` |

## Kafka Topics Consumed

| Topic | Purpose |
|---|---|
| `identity.user.registered` | Create provider stub when role = provider |
| `identity.user.suspended` | Deactivate provider if user suspended |
| `booking.completed` | Increment totalJobs, recompute completionRate |
| `booking.cancelled` | Recompute completionRate |
| `booking.created` | Record response time for stats |

---

## Dependencies

| Dependency | Purpose |
|---|---|
| Identity Service | User info via internal API (`GET /internal/users/:id`) |
| Redis | Search cache, autocomplete cache, matching config |
| S3 | Document and profile image storage |
| Kafka | Event production and consumption |

---

## Data It Does NOT Own

| Data | Owner | How Provider Service Accesses It |
|---|---|---|
| User name, email, avatar | Identity Service | Internal API call or Kafka event projection |
| Booking status, scheduling | Booking Service | Kafka events (for stats) |
| Payment status | Payment Service | Not accessed directly |

---

## Key Data Flow — Provider Registration

```
Identity Service        Kafka             Provider Service         S3
     |                    |                     |                     |
     |-- identity.user.registered -->|          |                     |
     |                    |          |-- create ProviderProfile stub  |
     |                    |          |                     |           |
     |                    |          |-- (provider completes profile) |
     |                    |          |-- upload docs ---------------->|
     |                    |          |-- admin approves               |
     |                    |          |-- publish provider.verified    |
     |                    |          |                     |           |
```
