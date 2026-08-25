import { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const sendError = (res: Response, status: number, message: string) => {
  return res.status(status).json({ success: false, message });
};

export const errorHandler = (
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) => {
  if (err instanceof ZodError) {
    return sendError(res, 400, err.issues[0]?.message || "Invalid request");
  }

  const { statusCode, message } = (err ?? {}) as {
    statusCode?: number;
    message?: string;
  };

  if (statusCode) {
    return sendError(res, statusCode, message || "Identity service error");
  }

  console.error("[Identity] Unhandled error:", err);
  return sendError(res, 500, "Internal server error");
};
