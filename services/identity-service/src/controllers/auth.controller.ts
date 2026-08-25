import { Request, Response, NextFunction } from "express";
import * as authService from "../services/authService";
import {
  registerSchema,
  loginSchema,
  verifyEmailSchema,
} from "../validation/authValidation";

export const register = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = registerSchema.parse(req.body);
    const tokens = await authService.register(input);
    res.status(201).json({ success: true, data: tokens });
  } catch (error) {
    next(error);
  }
};

export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = loginSchema.parse(req.body);
    const tokens = await authService.login(input);
    res.json({ success: true, data: tokens });
  } catch (error) {
    next(error);
  }
};

export const refresh = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ success: false, message: "Refresh token required" });
    }
    const tokens = await authService.refreshTokens(refreshToken);
    res.json({ success: true, data: tokens });
  } catch (error) {
    next(error);
  }
};

export const logout = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await authService.logout(req.user!.id, req.body.refreshToken);
    res.json({ success: true, data: { message: "Logged out" } });
  } catch (error) {
    next(error);
  }
};

export const verifyEmail = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = verifyEmailSchema.parse(req.body);
    const result = await authService.verifyEmail(input.token);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const resendVerification = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await authService.resendVerificationEmail(req.user!.id);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const logoutAll = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await authService.logoutAll(req.user!.id);
    res.json({ success: true, data: { message: "All sessions invalidated" } });
  } catch (error) {
    next(error);
  }
};
