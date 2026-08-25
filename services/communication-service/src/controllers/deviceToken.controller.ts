import { Request, Response } from "express";
import * as deviceTokenService from "../services/deviceTokenService";

export const registerDeviceToken = async (req: Request, res: Response) => {
  const { token, platform } = req.body;
  await deviceTokenService.registerDeviceToken(req.user!.id, token, platform);
  res.json({ success: true, data: { registered: true } });
};

export const removeDeviceToken = async (req: Request, res: Response) => {
  const { token } = req.body;
  await deviceTokenService.removeDeviceToken(token);
  res.json({ success: true, data: { removed: true } });
};
