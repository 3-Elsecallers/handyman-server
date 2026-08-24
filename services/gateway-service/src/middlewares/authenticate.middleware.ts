import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import "dotenv/config";

import { IUserPayload } from "../types/custom";

declare module "express-serve-static-core" {
  interface Request {
    user?: IUserPayload;
  }
}

export const authenticate = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) return res.sendStatus(401);

    jwt.verify(
      token,
      process.env.ACCESS_TOKEN_SECRET!,
      (
        error: jwt.VerifyErrors | null,
        payload?: IUserPayload | jwt.JwtPayload | string,
      ) => {
        if (error) return res.sendStatus(403);

        req.user = payload as IUserPayload;
        next();
      },
    );
  } catch (error) {
    console.error("[Gateway] Authentication error:", error);
    return res.sendStatus(500);
  }
};
