import { NextFunction, Request, Response } from "express";

import { sendError } from "./errorHandler.middleware";

const BODY_METHODS = ["POST", "PUT", "PATCH"];
const SUPPORTED_CONTENT_TYPES = [
  "application/json",
  "multipart/form-data",
  "application/x-www-form-urlencoded",
];

export const validateRequest = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (BODY_METHODS.includes(req.method)) {
    const contentType = req.headers["content-type"];

    if (
      contentType &&
      !SUPPORTED_CONTENT_TYPES.some((type) => contentType.startsWith(type))
    ) {
      return sendError(res, 415, `Unsupported media type: ${contentType}`);
    }
  }

  next();
};
