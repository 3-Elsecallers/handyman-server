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
  err: { statusCode?: number; message?: string },
  _req: Request,
  res: Response,
  _next: NextFunction,
) => {
  if (err instanceof AppError) {
    return sendError(res, err.statusCode, err.message);
  }

  if (err.statusCode) {
    return sendError(res, err.statusCode, err.message || "Identity service error");
  }

  console.error("[Identity] Unhandled error:", err);
  return sendError(res, 500, "Internal server error");
};
