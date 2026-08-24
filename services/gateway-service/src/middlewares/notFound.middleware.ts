import { Request, Response } from "express";

import { sendError } from "./errorHandler.middleware";

export const notFound = (req: Request, res: Response) => {
  sendError(res, 404, `Route not found: ${req.method} ${req.originalUrl}`);
};
