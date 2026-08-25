import { prisma } from "../db/prisma";
import { AppError } from "../middlewares/errorHandler.middleware";
import { Prisma } from "../../generated/prisma";
import type { NotificationType, NotificationChannel } from "../../generated/prisma";

export const createNotification = async (
  userId: string,
  type: NotificationType,
  channel: NotificationChannel,
  title: string,
  body: string,
  data?: Record<string, unknown>,
) => {
  return prisma.notification.create({
    data: {
      userId,
      type,
      channel,
      title,
      body,
      data: (data as Prisma.InputJsonValue) ?? undefined,
    },
  });
};

export const getNotifications = async (
  userId: string,
  limit: number = 20,
  cursor?: string,
) => {
  const where: Record<string, unknown> = { userId };
  if (cursor) {
    where.createdAt = { lt: new Date(cursor) };
  }

  const notifications = await prisma.notification.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit + 1,
  });

  const hasMore = notifications.length > limit;
  const data = hasMore ? notifications.slice(0, limit) : notifications;

  return {
    notifications: data,
    nextCursor: hasMore ? data[data.length - 1].createdAt.toISOString() : null,
  };
};

export const getUnreadCount = async (userId: string) => {
  const count = await prisma.notification.count({
    where: { userId, readAt: null },
  });
  return count;
};

export const markAsRead = async (notificationId: string, userId: string) => {
  const notification = await prisma.notification.findUnique({
    where: { id: notificationId },
  });
  if (!notification) throw new AppError(404, "Notification not found");
  if (notification.userId !== userId) throw new AppError(403, "Forbidden");

  return prisma.notification.update({
    where: { id: notificationId },
    data: { readAt: new Date() },
  });
};

export const markAllAsRead = async (userId: string) => {
  await prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
};
