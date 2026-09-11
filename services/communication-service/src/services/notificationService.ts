import { prisma } from "../db/prisma";
import { config } from "../config/env";
import { AppError } from "../middlewares/errorHandler.middleware";
import { isChannelEnabled } from "./preferenceService";
import { sendToUser } from "../websocket/server";
import { Prisma } from "../../generated/prisma";
import type {
  Notification,
  NotificationType,
  NotificationChannel,
} from "../../generated/prisma";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

const RATE_LIMITS: Partial<
  Record<NotificationType, { limit: number; windowMs: number }>
> = {
  booking_reminder_24h: { limit: 1, windowMs: DAY_MS },
  booking_reminder_1h: { limit: 1, windowMs: HOUR_MS },
  payment_reminder: { limit: 1, windowMs: DAY_MS },
  payment_received: { limit: 1, windowMs: DAY_MS },
  new_review: { limit: 3, windowMs: HOUR_MS },
};

const rateLimitFor = (type: NotificationType) =>
  RATE_LIMITS[type] ?? {
    limit: config.notification.rateLimit,
    windowMs: config.notification.rateWindowMs,
  };

const dedupeKey = (data?: Record<string, unknown>) => {
  if (data == null) return null;
  if (typeof data.bookingId === "string") return data.bookingId;
  if (typeof data.userId === "string") return data.userId;
  if (typeof data.providerId === "string") return data.providerId;
  if (typeof data.reviewId === "string") return data.reviewId;
  return null;
};

const dedupePath = (data?: Record<string, unknown>): string | null => {
  if (data == null) return null;
  if (typeof data.bookingId === "string") return "bookingId";
  if (typeof data.userId === "string") return "userId";
  if (typeof data.providerId === "string") return "providerId";
  if (typeof data.reviewId === "string") return "reviewId";
  return null;
};

export const createNotification = async (
  userId: string,
  type: NotificationType,
  channel: NotificationChannel,
  title: string,
  body: string,
  data?: Record<string, unknown>,
  opts?: { preferOverridePrefs?: boolean },
): Promise<Notification | null> => {
  const bookmarkId = dedupeKey(data);
  const bookmarkPath = dedupePath(data);

  if (!opts?.preferOverridePrefs) {
    const enabled = await isChannelEnabled(userId, type, channel);
    if (!enabled) {
      console.log(
        `[Notifications] Skipping ${type} for ${userId}: channel ${channel} disabled by preferences`,
      );
      return null;
    }
  }

  const windowStart = new Date(Date.now() - rateLimitFor(type).windowMs);

  if (bookmarkId) {
    const dupes = await prisma.notification.count({
      where: {
        userId,
        type,
        data: { path: [bookmarkPath as string], equals: bookmarkId },
        createdAt: { gte: windowStart },
      },
    });
    if (dupes > 0) {
      console.log(
        `[Notifications] Skipping ${type} for ${userId}: duplicate for ${bookmarkId} within window`,
      );
      return null;
    }
  }

  const recent = await prisma.notification.count({
    where: {
      userId,
      type,
      createdAt: { gte: windowStart },
    },
  });

  if (recent >= rateLimitFor(type).limit) {
    console.log(
      `[Notifications] Skipping ${type} for ${userId}: rate limited (${recent} in window)`,
    );
    return null;
  }

  const notification = await prisma.notification.create({
    data: {
      userId,
      type,
      channel,
      title,
      body,
      status: "pending",
      data: (data as Prisma.InputJsonValue) ?? undefined,
    },
  });

  // Push a realtime event to any online socket for this recipient.
  sendToUser(userId, { event: "notification:new", data: notification });

  return notification;
};

export const getNotifications = async (
  userId: string,
  limit: number = 20,
  cursor?: string,
  types?: string[],
) => {
  const where: Record<string, unknown> = { userId };
  if (cursor) {
    where.createdAt = { lt: new Date(cursor) };
  }
  if (types && types.length > 0) {
    where.type = { in: types };
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

export const markByContextAsRead = async (
  userId: string,
  context: { providerId?: string; providerServiceId?: string },
) => {
  const filters: Prisma.NotificationWhereInput[] = [];
  if (context.providerId) {
    filters.push({ data: { path: ["providerId"], equals: context.providerId } });
  }
  if (context.providerServiceId) {
    filters.push({
      data: { path: ["providerServiceId"], equals: context.providerServiceId },
    });
  }
  if (filters.length === 0) return { marked: 0 };

  const result = await prisma.notification.updateMany({
    where: {
      userId,
      readAt: null,
      OR: filters,
    },
    data: { readAt: new Date() },
  });

  return { marked: result.count };
};