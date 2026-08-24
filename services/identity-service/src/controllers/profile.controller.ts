import { Request, Response, NextFunction } from "express";
import * as userService from "../services/userService";
import { updateProfileSchema } from "../validation/profileValidation";

export const getProfile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const profile = await userService.getProfile(req.user!.id);
    res.json({ success: true, data: profile });
  } catch (error) {
    next(error);
  }
};

export const updateProfile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = updateProfileSchema.parse(req.body);
    const profile = await userService.updateProfile(req.user!.id, input);
    res.json({ success: true, data: profile });
  } catch (error) {
    next(error);
  }
};

export const uploadAvatar = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { avatarUrl } = req.body;
    if (!avatarUrl) {
      return res.status(400).json({ success: false, message: "avatarUrl required" });
    }
    const result = await userService.uploadAvatar(req.user!.id, avatarUrl);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};
