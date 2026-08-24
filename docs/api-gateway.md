# API Gateway

---

## Overview

The API Gateway is the single entry point for all client requests. It handles routing, authentication validation, rate limiting, and request shaping. It contains no business logic and has no database. All requests are proxied to the appropriate downstream service.

---

## Responsibilities

- Request routing to downstream services
- JWT access token validation (signature + expiry)
- Rate limiting per IP and per user
- Request/response logging and metrics
- CORS configuration
- Request body size limits
- WebSocket connection upgrade proxying
- Service-to-service token injection for internal routes

---

## Routing Table

Each route prefix maps to exactly one downstream service.

| Route Prefix | Target Service | Auth Required | Notes |
|---|---|---|---|
| `/auth/*` | Identity Service | No | Registration, login, OAuth |
| `/customers/*` | Identity Service | Yes (customer) | Profile, addresses, favorites |
| `/providers/*` | Provider Service | Yes (provider or public) | Provider management |
| `/services/*` | Provider Service | No (public read) | Catalog browsing |
| `/matching/*` | Provider Service | Yes (customer) | Provider search/match |
| `/search/*` | Provider Service | Yes (optional) | Search with filters |
| `/bookings/*` | Booking Service | Yes (customer or provider) | Booking lifecycle |
| `/payments/*` | Payment Service | Yes (customer or provider) | Payment operations |
| `/messages/*` | Communication Service | Yes (customer or provider) | Chat |
| `/notifications/*` | Communication Service | Yes | Notification prefs/history |
| `/admin/*` | Fan-out to all | Yes (admin) | Admin endpoints |
| `/webhooks/*` | Payment Service | No (webhook sig) | Paystack webhooks |
| `/ws/messages` | Communication Service | Yes (upgrade) | WebSocket chat |

---

## Middleware Pipeline

```
Request
  |
  v
(1) CORS
  |
  v
(2) Body Parser (5MB limit)
  |
  v
(3) Rate Limiter (Redis sliding window)
  |   - Anonymous: 30 req/min per IP
  |   - Authenticated: 120 req/min per user
  |   - Admin: 300 req/min per user
  |
  v
(4) Request Logger (method, path, latency, status)
  |
  v
(5) JWT Validation (if route requires auth)
  |   - Verify RS256 signature
  |   - Check expiry
  |   - Attach { userId, role, email } to context
  |
  v
(6) Role Gate (if role requirement)
  |   - customer routes: reject if role != customer
  |   - provider routes: reject if role not in [provider, admin]
  |   - admin routes: reject if role != admin
  |
  v
(7) Proxy to target service
```

---

## Internal Service Mesh

The gateway also routes internal service-to-service requests. These are authenticated via service tokens (not user JWTs).

| Internal Prefix | Target | Purpose |
|---|---|---|
| `/internal/users/*` | Identity Service | User lookups |
| `/internal/providers/*` | Provider Service | Provider lookups, availability checks |
| `/internal/services/*` | Provider Service | Service catalog lookups |
| `/internal/bookings/*` | Booking Service | Booking lookups |
| `/internal/payments/*` | Payment Service | Payment operations |
| `/internal/notifications/*` | Communication Service | Notification dispatch |

**Service-to-service auth**: Each internal request includes an `X-Service-Token` header. The gateway validates this token against a shared secret or signed JWT. This prevents unauthorized external access to internal endpoints.

---

## Rate Limiting

| Scope | Limit | Window |
|---|---|---|
| Anonymous per IP | 30 | 1 minute |
| Authenticated per user | 120 | 1 minute |
| Admin per user | 300 | 1 minute |
| Auth endpoints | 10 | 15 minutes per email |
| Payment endpoints | 20 | 1 minute per user |

Rate limit headers:
```
X-RateLimit-Limit: 120
X-RateLimit-Remaining: 98
X-RateLimit-Reset: 1711234567
```

---

## JWT Validation

The gateway validates JWTs but does not check token revocation on every request. Revocation is handled by:

1. Short-lived access tokens (15 min)
2. Identity Service publishes `identity.user.suspended` for suspended users
3. For high-security operations, the target service calls Identity Service to verify

### Token Payload

```json
{
  "sub": "uuid",
  "email": "user@example.com",
  "role": "customer",
  "iat": 1711234567,
  "exp": 1711235467
}
```

---

## WebSocket Proxy

For `/ws/messages`:
1. Receives HTTP Upgrade request
2. Validates JWT from query param
3. Proxies to Communication Service
4. Maintains connection for session lifetime

---

## Error Responses

```json
{
  "error": {
    "code": "RATE_LIMITED",
    "message": "Too many requests. Retry after 30s.",
    "retryAfter": 30
  }
}
```

| Status | Code | When |
|---|---|---|
| 401 | UNAUTHORIZED | Missing or invalid JWT |
| 403 | FORBIDDEN | Insufficient role |
| 404 | NOT_FOUND | Route not matched |
| 413 | PAYLOAD_TOO_LARGE | Body > 5MB |
| 429 | RATE_LIMITED | Rate limit exceeded |
| 502 | BAD_GATEWAY | Target service unavailable |
| 504 | GATEWAY_TIMEOUT | Target service > 30s |

---

## Events Published

None. The API Gateway is stateless.

## Events Consumed

None.

---

## Dependencies

| Dependency | Purpose |
|---|---|
| Redis | Rate limiting counters |
| All downstream services | Proxy targets |
