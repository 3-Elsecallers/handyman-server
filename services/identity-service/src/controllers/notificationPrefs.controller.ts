import { Request, Response, NextFunction } from "express";
import * as notificationPrefsService from "../services/notificationPrefsService";
import { updateNotificationPrefsSchema } from "../validation/profileValidation";

export const getPreferences = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const prefs = await notificationPrefsService.getPreferences(req.user!.id);
    res.json({ success: true, data: prefs });
  } catch (error) {
    next(error);
  }
};

export const updatePreferences = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = updateNotificationPrefsSchema.parse(req.body);
    const prefs = await notificationPrefsService.updatePreferences(req.user!.id, input);
    res.json({ success: true, data: prefs });
  } catch (error) {
    next(error);
  }
};
