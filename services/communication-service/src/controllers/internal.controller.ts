import { Request, Response } from "express";
import * as conversationService from "../services/conversationService";
import * as notificationService from "../services/notificationService";
import type { NotificationType, NotificationChannel } from "../../generated/prisma";

export const getConversationByBooking = async (req: Request, res: Response) => {
  const conversation = await conversationService.getOrCreateConversation(
    req.params.bookingId as string,
    req.body.customerId,
    req.body.providerId,
  );
  res.json({ success: true, data: conversation });
};

export const sendNotification = async (req: Request, res: Response) => {
  const { userId, type, channel, title, body, data } = req.body;
  const notification = await notificationService.createNotification(
    userId,
    type as NotificationType,
    channel as NotificationChannel,
    title,
    body,
    data,
  );
  res.status(201).json({ success: true, data: notification });
};
