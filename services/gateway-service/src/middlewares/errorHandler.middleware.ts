import { NextFunction, Request, Response } from "express";

export const sendError = (res: Response, status: number, message: string) => {
  return res.status(status).json({ success: false, message });
};

export const errorHandler = (
  err: {
    statusCode?: number;
    message?: string;
  },
  _req: Request,
  res: Response,
  _next: NextFunction,
) => {
  if (err.statusCode) {
    return sendError(res, err.statusCode, err.message || "Gateway error");
  }

  console.error("[Gateway] Unhandled error:", err);
  return sendError(res, 500, "Internal server error");
};
