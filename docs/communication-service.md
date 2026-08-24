# Communication Service

---

## Overview

The Communication Service handles all user-facing message delivery: real-time in-app chat between customers and providers, and outbound notifications via push, email, and SMS. It has its own private database (`comm_db`). It consumes domain events from all other services and translates them into user notifications.

---

## Responsibilities

- Real-time WebSocket chat (booking-scoped conversations)
- Message persistence and history
- Image/file sharing in chat
- Read receipts and unread counts
- Typing indicators
- Push notifications (FCM/APNs)
- Email notifications (Resend / SES)
- SMS notifications (Twilio)
- User notification preferences enforcement
- Device token management
- Notification templates and rate limiting
- Fallback strategies (push -> SMS -> email)

---

## Database

Private PostgreSQL database: `comm_db`

### Prisma Schema

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum NotificationChannel {
  push
  email
  sms
}

enum NotificationType {
  booking_confirmed
  booking_reminder_24h
  booking_reminder_1h
  provider_en_route
  booking_completed
  new_review
  payment_received
  payment_refunded
  dispute_opened
  verification_result
  marketing
}

model Message {
  id        String   @id @default(uuid())
  bookingId String
  senderId  String
  content   String
  type      String   @default("text")
  imageUrl  String?
  readAt    DateTime?
  createdAt DateTime @default(now())

  @@index([bookingId, createdAt])
  @@index([senderId])
}

model Notification {
  id        String             @id @default(uuid())
  userId    String
  type      NotificationType
  channel   NotificationChannel
  title     String
  body      String
  data      Json?
  readAt    DateTime?
  sentAt    DateTime           @default(now())
  createdAt DateTime           @default(now())

  @@index([userId, readAt])
  @@index([userId, type])
}
```

**Note**: `Message.bookingId`, `Message.senderId`, and `Notification.userId` are UUIDs referencing data in other services' databases. No foreign key constraints. The Communication Service resolves these via Kafka events and internal API calls.

---

## Core Functionality

### Real-Time Messaging

#### WebSocket Protocol

- Connection authenticated via JWT in handshake
- One active connection per user; Redis tracks `ws:user:{userId} -> instanceId`
- Multi-instance fanout via Redis Pub/Sub
- Heartbeat every 30s

#### Message Flow

1. Client sends `message:send`
2. Validate: user is participant of the booking (call Booking Service internal API)
3. Persist to `Message` table
4. Broadcast to all booking participants via WebSocket
5. If recipient offline -> trigger push notification
6. Update unread count

#### Image Messages

1. Client requests presigned S3 URL
2. Uploads directly to S3
3. Sends message with `type: "image"` and `imageUrl`

### Notifications

#### Event-to-Notification Mapping

| Kafka Event | Push | Email | SMS | Template |
|---|---|---|---|---|
| `identity.user.registered` | - | Yes | - | welcome |
| `booking.created` | Yes (provider) | - | - | new_booking_request |
| `booking.confirmed` | Yes | Yes | - | booking_confirmed |
| `booking.started` | Yes (customer) | - | Yes | provider_en_route |
| `booking.completed` | Yes (customer) | Yes | - | review_request, receipt |
| `booking.cancelled` | Yes | Yes | - | booking_cancelled |
| `booking.disputed` | Yes (admin) | Yes (admin) | - | dispute_opened |
| `payment.captured` | - | Yes | - | payment_receipt |
| `payment.refunded` | Yes | Yes | - | refund_confirmation |
| `provider.review.submitted` | Yes (provider) | - | - | new_review |
| `provider.verified` | Yes | Yes | - | verification_result |

#### Fallback Strategy

For critical notifications:
1. Attempt push
2. If fails -> SMS
3. If fails -> email
4. All attempts logged

#### Rate Limiting

| Channel | Limit | Window |
|---|---|---|
| Push (non-critical) | 5 | per hour |
| Email (transactional) | Unlimited | - |
| Email (marketing) | 3 | per day |
| SMS | 2 | per day |

#### Preference Resolution

Before sending, Communication Service checks user preferences:
1. Call Identity Service: `GET /internal/users/:id/notification-prefs`
2. Check if the notification type + channel is enabled
3. Skip if disabled (except critical notifications)

---

## Internal API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| POST | `/internal/notifications/send` | Send notification |
| POST | `/internal/notifications/batch` | Batch send |

---

## Client-Facing APIs

### REST Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/bookings/:id/messages` | Message history |
| GET | `/bookings/:id/messages/unread` | Unread count |
| POST | `/bookings/:id/messages/presign` | S3 presigned URL |
| GET | `/notifications` | Notification history |
| GET | `/notifications/unread-count` | Unread count |
| PUT | `/notifications/:id/read` | Mark read |
| PUT | `/notifications/read-all` | Mark all read |
| POST | `/notifications/device-token` | Register device |
| DELETE | `/notifications/device-token` | Remove device |

### WebSocket

| Endpoint | Description |
|---|---|
| `ws://host/ws/messages` | Real-time chat |

---

## Kafka Topics Published

| Topic | Key | Payload |
|---|---|---|
| `message.sent` | messageId | `{ bookingId, messageId, senderId, type }` |

## Kafka Topics Consumed

| Topic | Purpose |
|---|---|
| `identity.user.registered` | Welcome email |
| `booking.created` | Notify provider |
| `booking.confirmed` | Notify customer |
| `booking.started` | Notify customer (push + SMS) |
| `booking.completed` | Notify customer (review request + receipt) |
| `booking.cancelled` | Notify both parties |
| `booking.disputed` | Notify admin |
| `payment.captured` | Payment receipt |
| `payment.refunded` | Refund confirmation |
| `payment.payout.completed` | Provider payout notification |
| `provider.review.submitted` | Notify provider of review |
| `provider.verified` | Notify provider of result |

---

## Dependencies

| Dependency | Purpose | How Accessed |
|---|---|---|
| Identity Service | User contact info, notification prefs | Internal API |
| Booking Service | Booking context (for chat validation) | Internal API |
| FCM / APNs | Push delivery | Firebase Admin SDK |
| Resend / SES | Email delivery | HTTP API |
| Twilio | SMS delivery | HTTP API |
| Redis | WebSocket fanout, device tokens, presence | Shared Redis |
| S3 | Chat image storage | AWS SDK |

---

## Data It Does NOT Own

| Data | Owner | How Communication Service Accesses It |
|---|---|---|
| User name, email, phone | Identity Service | Internal API + Kafka event projection |
| Notification preferences | Identity Service | Internal API (`GET /internal/users/:id/notification-prefs`) |
| Booking details | Booking Service | Kafka events + internal API |
| Provider info | Provider Service | Not accessed directly |

---

## Key Data Flow - Messaging

```
Client (Mobile)     Communication Service     Redis        S3
  |                        |                     |           |
  |-- ws message:send ---->|                     |           |
  |                        |-- validate via Booking Svc API |
  |                        |-- persist message   |           |
  |                        |-- broadcast via PubSub ->|      |
  |<- message:new ---------|                     |           |
  |                        |-- if offline: push notification |
```

## Key Data Flow - Notifications

```
Booking Svc      Kafka          Communication Service    Identity Svc    FCM/SES
  |                |                    |                     |             |
  |-- booking.completed -------------->|                     |             |
  |                |                    |-- GET /internal/users/:id/notification-prefs ->|
  |                |                    |<- { prefs } --------|             |
  |                |                    |                     |             |
  |                |                    |-- check prefs       |             |
  |                |                    |-- rate limit check  |             |
  |                |                    |-- send push ---------------------->|
  |                |                    |-- send email --------------------->|
  |                |                    |-- persist to DB     |             |
```
