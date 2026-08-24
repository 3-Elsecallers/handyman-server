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
  publicPaths: RegExp[];
  roleGuards: RoleGuard[];
}

export const services: ServiceConfig[] = [
  {
    name: "identity-service",
    baseUrl: process.env.IDENTITY_SERVICE_URL || "http://localhost:8081",
    prefixes: ["/auth", "/customers", "/admin"],
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
      { path: /^\/admin\//, roles: ["admin"] },
    ],
  },
];
