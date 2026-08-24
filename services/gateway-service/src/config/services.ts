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

export const services: ServiceConfig[] = [];
