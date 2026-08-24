import { NextFunction, Request, Response } from "express";

import { ServiceConfig, services } from "../config/services";
import { authenticate } from "./authenticate.middleware";
import { authorize } from "./authorize.middleware";
import { proxyTo } from "./proxy.middleware";

const isServicePath = (service: ServiceConfig, path: string) =>
  service.prefixes.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );

const isPublicPath = (service: ServiceConfig, path: string) =>
  service.publicPaths.some((regex) => regex.test(path));

const findRoleGuard = (service: ServiceConfig, method: string, path: string) =>
  service.roleGuards.find(
    (guard) =>
      (!guard.method || guard.method === method) && guard.path.test(path),
  );

export const gateway = (req: Request, res: Response, next: NextFunction) => {
  const service = services.find((s) => isServicePath(s, req.path));
  if (!service) return next();

  if (isPublicPath(service, req.path)) {
    return proxyTo(service)(req, res, next);
  }

  return authenticate(req, res, () => {
    const guard = findRoleGuard(service, req.method, req.path);
    if (guard) {
      return authorize(...guard.roles)(req, res, () =>
        proxyTo(service)(req, res, next),
      );
    }
    return proxyTo(service)(req, res, next);
  });
};
