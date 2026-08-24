import { createProxyMiddleware } from "http-proxy-middleware";
import { RequestHandler } from "express";

import { ServiceConfig } from "../config/services";
import { IUserPayload } from "../types/custom";

export const proxyTo = (service: ServiceConfig): RequestHandler => {
  return createProxyMiddleware({
    target: service.baseUrl,
    changeOrigin: true,
    on: {
      proxyReq: (proxyReq, req, _res) => {
        const user = (req as unknown as { user?: IUserPayload }).user;
        if (user) {
          if (user.id) proxyReq.setHeader("x-user-id", user.id);
          if (user.name) proxyReq.setHeader("x-user-name", user.name);
          if (user.email) proxyReq.setHeader("x-user-email", user.email);
          if (user.phone) proxyReq.setHeader("x-user-phone", user.phone);
          if (user.role) {
            proxyReq.setHeader("x-user-role", user.role);
          }
        }
      },
      error: (err, _req, res) => {
        const code = (err as NodeJS.ErrnoException).code;
        const upstreamDown =
          code === "ECONNREFUSED" ||
          code === "ECONNRESET" ||
          code === "ETIMEDOUT" ||
          code === "ECONNABORTED";
        console.error(
          `[Gateway] Proxy error -> ${service.name}: ${err.message}`,
        );

        const serverRes = res as unknown as {
          headersSent: boolean;
          writeHead: (status: number, headers?: Record<string, string>) => void;
          end: (chunk?: string) => void;
        };

        if (serverRes.headersSent) {
          serverRes.end();
          return;
        }

        serverRes.writeHead(upstreamDown ? 503 : 502, {
          "Content-Type": "application/json",
        });
        serverRes.end(
          JSON.stringify({
            success: false,
            message: upstreamDown
              ? "Upstream service unavailable"
              : "Bad gateway",
          }),
        );
      },
    },
  });
};
