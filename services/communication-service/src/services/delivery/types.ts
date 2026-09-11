import type { Notification, NotificationChannel } from "../../../generated/prisma";

export interface DeliveryTarget {
  user?: {
    id: string;
    email?: string | null;
    phone?: string | null;
  } | null;
  deviceTokens: string[];
}

export interface DeliveryResult {
  channel: NotificationChannel;
  ok: boolean;
  error?: string;
}

export interface DeliveryProvider {
  readonly channel: NotificationChannel;
  deliver(
    notification: Notification,
    target: DeliveryTarget,
  ): Promise<DeliveryResult>;
}