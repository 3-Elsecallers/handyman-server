import { Request, Response, NextFunction } from "express";
import * as adminService from "../services/adminService";
import * as catalogService from "../services/catalogService";
import * as reviewService from "../services/reviewService";

export const getVerificationQueue = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const result = await adminService.getVerificationQueue(page, limit);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const verifyProvider = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { approved } = req.body;
    if (typeof approved !== "boolean") {
      return res.status(400).json({ success: false, message: "approved boolean required" });
    }
    const result = await adminService.verifyProvider(
      req.params.id as string,
      approved,
      req.user!.id,
    );
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const createCategory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await adminService.createCategory(req.body, req.user!.id);
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const updateCategory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await adminService.updateCategory(
      req.params.id as string,
      req.body,
      req.user!.id,
    );
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const createService = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await adminService.createService(req.body, req.user!.id);
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const updateService = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await adminService.updateService(
      req.params.id as string,
      req.body,
      req.user!.id,
    );
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const getFlaggedReviews = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const result = await reviewService.getFlaggedReviews(page, limit);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const moderateReview = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status } = req.body;
    if (!["visible", "flagged", "removed"].includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status" });
    }
    const result = await reviewService.moderateReview(req.params.id as string, status);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const getAuditLog = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const result = await adminService.getAuditLog(page, limit);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};
