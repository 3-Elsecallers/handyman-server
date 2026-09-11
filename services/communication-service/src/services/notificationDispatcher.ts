import { prisma } from "../db/prisma";
import { config } from "../config/env";
import { getDeviceTokens } from "./deviceTokenService";
import { PushProvider } from "./delivery/push.provider";
import { EmailProvider } from "./delivery/email.provider";
import { SmsProvider } from "./delivery/sms.provider";
import type { DeliveryProvider, DeliveryTarget } from "./delivery/types";
import { Prisma } from "../../generated/prisma";
import type {
  Notification,
  NotificationChannel,
  NotificationStatus,
} from "../../generated/prisma";

const FALLBACK_ORDER: NotificationChannel[] = ["push", "sms", "email"];

const providers: Record<NotificationChannel, DeliveryProvider> = {
  push: new PushProvider(),
  email: new EmailProvider(),
  sms: new SmsProvider(),
};

interface DeliveryAttempt {
  channel: NotificationChannel;
  at: string;
  ok: boolean;
  error?: string | null;
}

const getUserProfile = async (
  userId: string,
): Promise<DeliveryTarget["user"]> => {
  try {
    const res = await fetch(`${config.identityServiceUrl}/internal/users/${userId}`, {
      headers: { "x-service-token": config.internalServiceToken },
    });
    if (!res.ok) throw new Error(`identity returned ${res.status}`);
    const json = (await res.json()) as {
      data?: { id: string; email?: string | null; phone?: string | null };
    };
    if (!json.data) return null;
    return {
      id: userId,
      email: json.data.email ?? undefined,
      phone: json.data.phone ?? undefined,
    };
  } catch (error) {
    console.error(`[Delivery] Failed to resolve user profile for ${userId}:`, error);
    return null;
  }
};

export const dispatchNotification = async (notification: Notification) => {
  const [user, deviceTokens] = await Promise.all([
    getUserProfile(notification.userId),
    getDeviceTokens(notification.userId),
  ]);

  const target: DeliveryTarget = {
    user,
    deviceTokens: deviceTokens.map((t) => t.token),
  };

  const attempts: DeliveryAttempt[] = [];
  const ordered = [
    notification.channel,
    ...FALLBACK_ORDER.filter((c) => c !== notification.channel),
  ];

  let status: NotificationStatus = "failed";
  for (const channel of ordered) {
    const result = await providers[channel].deliver(notification, target);
    attempts.push({
      channel,
      at: new Date().toISOString(),
      ok: result.ok,
      error: result.error ?? null,
    });
    if (result.ok) {
      status = "delivered";
      break;
    }
  }

  const existingData = (notification.data as Record<string, unknown> | null) ?? {};
  return prisma.notification.update({
    where: { id: notification.id },
    data: {
      status,
      deliveryAttempts: { increment: 1 },
      lastDeliveryAt: new Date(),
      data: { ...existingData, delivery: attempts } as unknown as Prisma.InputJsonValue,
    },
  });
};

export const dispatchPendingNotifications = async (limit: number = 100) => {
  const pending = await prisma.notification.findMany({
    where: { status: "pending" },
    orderBy: { createdAt: "asc" },
    take: limit,
  });

  for (const notification of pending) {
    await dispatchNotification(notification);
  }

  return pending.length;
};

export const startNotificationSweeper = () => {
  const run = () => {
    dispatchPendingNotifications().catch((error) => {
      console.error("[Delivery] Notification sweep failed:", error);
    });
  };

  // Run once shortly after boot, then on the configured interval.
  const timer = setTimeout(() => {
    run();
    setInterval(run, config.notification.sweepIntervalMs);
  }, 1_000);

  timer.unref?.();
};