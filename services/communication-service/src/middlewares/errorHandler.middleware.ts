import { NextFunction, Request, Response } from "express";

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
  if (err instanceof AppError) {
    return sendError(res, err.statusCode, err.message);
  }

  const { statusCode, message } = (err ?? {}) as {
    statusCode?: number;
    message?: string;
  };

  if (statusCode) {
    return sendError(res, statusCode, message || "Communication service error");
  }

  console.error("[Communication] Unhandled error:", err);
  return sendError(res, 500, "Internal server error");
};
