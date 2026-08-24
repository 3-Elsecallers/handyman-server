import { Request, Response, NextFunction } from "express";
import * as userService from "../services/userService";
import * as notificationPrefsService from "../services/notificationPrefsService";

export const getUserById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await userService.getUserById(req.params.id as string);
    res.json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
};

export const getNotificationPrefs = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const prefs = await notificationPrefsService.getPreferences(req.params.id as string);
    res.json({ success: true, data: prefs });
  } catch (error) {
    next(error);
  }
};

export const validateUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userIds } = req.body;
    if (!Array.isArray(userIds)) {
      return res.status(400).json({ success: false, message: "userIds array required" });
    }
    const users = await userService.getUsersByIds(userIds);
    res.json({ success: true, data: users });
  } catch (error) {
    next(error);
  }
};

export const batchGetUsers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ids = (req.query.ids as string)?.split(",") || [];
    const users = await userService.getUsersByIds(ids);
    res.json({ success: true, data: users });
  } catch (error) {
    next(error);
  }
};
