import { NextFunction, Request, Response } from "express";
import { config } from "../config/env";
import type { IUserPayload } from "../types/custom";

export const authenticateFromHeaders = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const userId = req.headers["x-user-id"];
  if (!userId) {
    return res
      .status(401)
      .json({ success: false, message: "Missing user identity headers" });
  }

  req.user = {
    id: userId as string,
    name: (req.headers["x-user-name"] as string) || "",
    email: req.headers["x-user-email"] as string | undefined,
    phone: req.headers["x-user-phone"] as string | undefined,
    role: ((req.headers["x-user-role"] as string) || "customer") as IUserPayload["role"],
  };

  next();
};

export const requireRole = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res
        .status(403)
        .json({ success: false, message: "Insufficient permissions" });
    }
    next();
  };
};

export const serviceAuth = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const token = req.headers["x-service-token"];
  if (token !== config.internalServiceToken) {
    return res
      .status(403)
      .json({ success: false, message: "Invalid service token" });
  }
  next();
};
