import "dotenv/config";

export type HttpMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

export interface RoleGuard {
  method?: HttpMethod;
  path: RegExp;
  roles: string[];
}

export interface ServiceConfig {
  name: string;
  baseUrl: string;
  prefixes: string[];
  excludePaths?: RegExp[];
  publicPaths: RegExp[];
  roleGuards: RoleGuard[];
}

export const services: ServiceConfig[] = [
  {
    name: "booking-service",
    baseUrl: process.env.BOOKING_SERVICE_URL || "http://localhost:8083",
    prefixes: [
      "/bookings",
      "/customers/bookings",
      "/providers/me/bookings",
      "/admin/bookings",
      "/admin/promos",
    ],
    excludePaths: [/^\/bookings\/[a-f0-9-]+\/review$/],
    publicPaths: [],
    roleGuards: [],
  },
  {
    name: "identity-service",
    baseUrl: process.env.IDENTITY_SERVICE_URL || "http://localhost:8081",
    prefixes: ["/auth", "/customers", "/admin/users"],
    publicPaths: [
      /^\/auth\/register/,
      /^\/auth\/login/,
      /^\/auth\/refresh/,
      /^\/auth\/social/,
      /^\/auth\/forgot-password/,
      /^\/auth\/reset-password/,
      /^\/auth\/verify-email/,
    ],
    roleGuards: [
      { path: /^\/admin\/users/, roles: ["admin"] },
    ],
  },
  {
    name: "provider-service",
    baseUrl: process.env.PROVIDER_SERVICE_URL || "http://localhost:8082",
    prefixes: ["/providers", "/search", "/matching", "/bookings", "/reviews", "/services", "/admin/providers", "/admin/services", "/admin/reviews", "/admin/audit-log", "/admin/documents"],
    publicPaths: [
      /^\/providers\/[a-f0-9-]+$/,
      /^\/search\//,
      /^\/services\/categories/,
      /^\/services\/[a-z0-9-]+$/,
      /^\/services$/,
    ],
    roleGuards: [
      { path: /^\/providers\/me/, roles: ["provider"] },
      { path: /^\/admin\//, roles: ["admin"] },
    ],
  },
  {
    name: "communication-service",
    baseUrl: process.env.COMMUNICATION_SERVICE_URL || "http://localhost:8085",
    prefixes: ["/conversations", "/notifications"],
    publicPaths: [],
    roleGuards: [],
  },
];
