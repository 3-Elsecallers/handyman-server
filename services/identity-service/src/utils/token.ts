import jwt from "jsonwebtoken";
import crypto from "crypto";
import { config } from "../config/env";
import type { IUserPayload } from "../types/custom";

export const generateAccessToken = (payload: IUserPayload): string =>
  jwt.sign(payload, config.accessTokenSecret, {
    expiresIn: config.accessTokenExpiry,
  });

export const generateRefreshToken = (): { token: string; expiresAt: Date } => {
  const token = crypto.randomBytes(40).toString("hex");
  const expiresAt = new Date(
    Date.now() + config.refreshTokenExpiryDays * 24 * 60 * 60 * 1000,
  );
  return { token, expiresAt };
};

export const verifyAccessToken = (token: string): IUserPayload | null => {
  try {
    return jwt.verify(token, config.accessTokenSecret) as IUserPayload;
  } catch {
    return null;
  }
};
