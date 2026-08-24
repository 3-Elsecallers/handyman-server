# Identity Service

---

## Overview

The Identity Service owns all user identity and profile concerns: authentication, registration, JWT management, OAuth, user profiles, saved addresses, favorites, and notification preferences. It is the authoritative source for user data and has its own private database (`identity_db`).

---

## Responsibilities

- User registration (email/password, phone)
- Login and logout
- JWT access token + refresh token issuance and rotation
- OAuth 2.0 (Google, Apple Sign-In)
- Password hashing (Argon2id) and reset flows
- Email verification
- Customer profile management (name, phone, avatar)
- Saved address CRUD
- Favorite provider management
- Notification preference management
- Provider stub creation on registration (when role = provider)

---

## Database

Private PostgreSQL database: `identity_db`

### Prisma Schema

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum UserRole {
  customer
  provider
  admin
}

model User {
  id            String    @id @default(uuid())
  email         String    @unique
  phone         String?   @unique
  passwordHash  String?
  role          UserRole  @default(customer)
  firstName     String
  lastName      String
  avatarUrl     String?
  emailVerified Boolean   @default(false)
  phoneVerified Boolean   @default(false)
  googleId      String?   @unique
  appleId       String?   @unique
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  addresses         Address[]
  favorites         FavoriteProvider[]
  refreshTokens     RefreshToken[]
  notificationPrefs UserNotificationPreferences?

  @@index([email])
  @@index([phone])
}

model RefreshToken {
  id        String   @id @default(uuid())
  userId    String
  token     String   @unique
  expiresAt DateTime
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([token])
  @@index([userId])
}

model Address {
  id         String   @id @default(uuid())
  userId     String
  label      String
  line1      String
  line2      String?
  city       String
  state      String
  postalCode String
  country    String   @default("US")
  lat        Float?
  lng        Float?
  isDefault  Boolean  @default(false)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
}

model FavoriteProvider {
  id         String   @id @default(uuid())
  customerId String
  providerId String
  createdAt  DateTime @default(now())

  user User @relation(fields: [customerId], references: [id], onDelete: Cascade)

  @@unique([customerId, providerId])
}

model UserNotificationPreferences {
  id     String @id @default(uuid())
  userId String @unique

  bookingConfirmedPush   Boolean @default(true)
  bookingConfirmedEmail  Boolean @default(true)
  bookingReminderPush    Boolean @default(true)
  bookingReminderSms     Boolean @default(true)
  reviewPush             Boolean @default(true)
  paymentReceivedEmail   Boolean @default(true)
  marketingPush          Boolean @default(false)
  marketingEmail         Boolean @default(false)

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

**Note**: `FavoriteProvider.providerId` is a UUID reference to a provider in the Provider Service's database. There is no foreign key constraint across databases. The Identity Service does not validate that the provider exists (the Provider Service does that when receiving requests).

---

## Core Functionality

### Registration

1. Validate input (email format, password strength, name)
2. Check email uniqueness
3. Hash password with Argon2id
4. Create `User` record
5. Generate email verification token (24h)
6. Publish `identity.user.registered` to Kafka
7. Return access + refresh tokens

### Login

1. Look up user by email
2. Verify password with Argon2id
3. Check user not suspended
4. Issue access token (15 min) + refresh token (7d)
5. Store refresh token hash in `RefreshToken` table

### Token Refresh

1. Validate refresh token exists and not expired
2. Rotate: delete old, issue new pair
3. Return new tokens

### OAuth

1. Validate provider token (Google/Apple API)
2. Match by OAuth ID (existing user) or email (link accounts) or create new
3. OAuth users skip email verification
4. Return tokens

### Profile Management

- Update name, phone, avatar
- Phone changes require SMS re-verification
- Avatar uploaded to S3, resized, URL stored on `User`
- Profile updates publish `identity.user.updated` to Kafka

### Address Management

- CRUD for saved addresses with labels
- One default per user
- Max 10 addresses
- Geocode on creation for lat/lng

### Favorites

- Toggle providers in/out of favorites list
- `providerId` stored as UUID; validation happens at Provider Service

---

## Internal API Endpoints

These endpoints are called by other services (authenticated via service-to-service token).

| Method | Endpoint | Description |
|---|---|---|
| GET | `/internal/users/:id` | Get user by ID |
| GET | `/internal/users/:id/notification-prefs` | Get notification preferences |
| POST | `/internal/users/validate` | Validate token + return user |
| GET | `/internal/users/batch` | Get multiple users by IDs |

### Response Schemas

#### GET `/internal/users/:id`

```json
{
  "id": "uuid",
  "email": "user@example.com",
  "phone": "+1234567890",
  "firstName": "John",
  "lastName": "Doe",
  "avatarUrl": "https://s3.../avatar.jpg",
  "role": "customer",
  "createdAt": "2026-01-15T00:00:00Z"
}
```

#### GET `/internal/users/:id/notification-prefs`

```json
{
  "userId": "uuid",
  "bookingConfirmedPush": true,
  "bookingConfirmedEmail": true,
  "bookingReminderPush": true,
  "bookingReminderSms": true,
  "reviewPush": true,
  "paymentReceivedEmail": true,
  "marketingPush": false,
  "marketingEmail": false
}
```

---

## Public / Client-Facing APIs

### Auth Routes (public)

| Method | Endpoint | Description |
|---|---|---|
| POST | `/auth/register` | Register |
| POST | `/auth/login` | Login |
| POST | `/auth/social` | OAuth login |
| POST | `/auth/refresh` | Refresh tokens |
| POST | `/auth/forgot-password` | Request password reset |
| POST | `/auth/reset-password` | Reset password |
| POST | `/auth/verify-email` | Verify email |

### Auth Routes (authenticated)

| Method | Endpoint | Description |
|---|---|---|
| POST | `/auth/logout` | Invalidate session |
| POST | `/auth/logout-all` | Invalidate all sessions |

### Customer Routes

| Method | Endpoint | Description |
|---|---|---|
| GET | `/customers/me` | Get profile |
| PUT | `/customers/me` | Update profile |
| POST | `/customers/me/avatar` | Upload avatar |
| GET | `/customers/addresses` | List addresses |
| POST | `/customers/addresses` | Add address |
| PUT | `/customers/addresses/:id` | Update address |
| DELETE | `/customers/addresses/:id` | Delete address |
| GET | `/customers/favorites` | List favorites |
| POST | `/customers/favorites/:providerId` | Add favorite |
| DELETE | `/customers/favorites/:providerId` | Remove favorite |
| GET | `/customers/notifications/preferences` | Get prefs |
| PUT | `/customers/notifications/preferences` | Update prefs |

### Admin Routes

| Method | Endpoint | Description |
|---|---|---|
| GET | `/admin/users` | List/search users |
| GET | `/admin/users/:id` | User detail |
| PUT | `/admin/users/:id/status` | Suspend/activate |

---

## Kafka Topics Published

| Topic | Key | Payload |
|---|---|---|
| `identity.user.registered` | userId | `{ userId, email, role, firstName, lastName }` |
| `identity.user.updated` | userId | `{ userId, fields: [...] }` |
| `identity.user.suspended` | userId | `{ userId, reason, adminId }` |

## Kafka Topics Consumed

None. Identity is a source-of-truth leaf.

---

## Dependencies

| Dependency | Purpose |
|---|---|
| Redis | Session caching, rate limiting |
| S3 | Avatar storage |

---

## Key Data Flow

```
Client              API Gateway           Identity Service       Kafka
  |                      |                       |                  |
  |-- POST /auth/register -->|                  |                  |
  |                      |-- route ------------>|                  |
  |                      |                      |-- create User    |
  |                      |                      |-- publish identity.user.registered -->|
  |<-- { tokens } -------|<---------------------|                  |
  |                      |                      |                  |
  |    Provider Service consumes event, creates ProviderProfile    |
```
