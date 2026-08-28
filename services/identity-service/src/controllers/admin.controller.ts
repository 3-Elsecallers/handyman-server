import { Request, Response, NextFunction } from "express";
import * as adminService from "../services/adminService";

export const listUsers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await adminService.listUsers({
      page: req.query.page ? parseInt(req.query.page as string) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
      search: req.query.search as string | undefined,
      role: req.query.role as string | undefined,
      status: req.query.status as string | undefined,
    });
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const getUserDetail = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await adminService.getUserDetail(req.params.id as string);
    res.json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
};

export const updateUserStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { action } = req.body;
    if (action !== "suspend" && action !== "activate") {
      return res.status(400).json({
        success: false,
        message: "Action must be 'suspend' or 'activate'",
      });
    }
    const result = await adminService.updateUserStatus(
      req.params.id as string,
      action,
      req.user!.id,
    );
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const deleteUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await adminService.deleteUser(
      req.params.id as string,
      req.user!.id,
    );
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
