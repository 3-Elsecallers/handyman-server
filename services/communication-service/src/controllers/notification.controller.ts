import { Request, Response } from "express";
import * as notificationService from "../services/notificationService";

export const listNotifications = async (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 20;
  const cursor = req.query.cursor as string | undefined;
  const typesRaw = (req.query.types as string | undefined) ?? "";
  const types = typesRaw
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  const data = await notificationService.getNotifications(
    req.user!.id,
    limit,
    cursor,
    types,
  );
  res.json({ success: true, data });
};

export const getUnreadCount = async (req: Request, res: Response) => {
  const count = await notificationService.getUnreadCount(req.user!.id);
  res.json({ success: true, data: { count } });
};

export const markAsRead = async (req: Request, res: Response) => {
  await notificationService.markAsRead(req.params.id as string, req.user!.id);
  res.json({ success: true, data: { marked: true } });
};

export const markAllAsRead = async (req: Request, res: Response) => {
  await notificationService.markAllAsRead(req.user!.id);
  res.json({ success: true, data: { marked: true } });
};

export const markByContextAsRead = async (req: Request, res: Response) => {
  const { providerId, providerServiceId } = req.body ?? {};
  const data = await notificationService.markByContextAsRead(req.user!.id, {
    providerId: typeof providerId === "string" ? providerId : undefined,
    providerServiceId:
      typeof providerServiceId === "string" ? providerServiceId : undefined,
  });
  res.json({ success: true, data });
};
