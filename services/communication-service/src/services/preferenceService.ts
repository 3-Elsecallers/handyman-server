import { config } from "../config/env";
import type { NotificationType, NotificationChannel } from "../../generated/prisma";

interface NotificationPrefs {
  bookingConfirmedPush: boolean;
  bookingConfirmedEmail: boolean;
  bookingReminderPush: boolean;
  bookingReminderSms: boolean;
  reviewPush: boolean;
  paymentReceivedEmail: boolean;
  marketingPush: boolean;
  marketingEmail: boolean;
}

type PrefFlag = keyof NotificationPrefs;

const TYPE_CHANNEL_FLAGS: Record<
  NotificationType,
  Partial<Record<NotificationChannel, PrefFlag>>
> = {
  booking_confirmed: {
    push: "bookingConfirmedPush",
    email: "bookingConfirmedEmail",
  },
  booking_cancelled: {
    push: "bookingConfirmedPush",
    email: "bookingConfirmedEmail",
  },
  booking_reminder_24h: {
    push: "bookingReminderPush",
    sms: "bookingReminderSms",
  },
  booking_reminder_1h: {
    push: "bookingReminderPush",
    sms: "bookingReminderSms",
  },
  provider_en_route: {
    push: "bookingConfirmedPush",
  },
  booking_started: {
    push: "bookingConfirmedPush",
  },
  booking_completed: {
    push: "bookingConfirmedPush",
    email: "bookingConfirmedEmail",
  },
  booking_reassigned: {
    push: "bookingConfirmedPush",
  },
  new_review: {
    push: "reviewPush",
  },
  payment_received: {
    push: "paymentReceivedEmail",
    email: "paymentReceivedEmail",
  },
  payment_refunded: {
    email: "paymentReceivedEmail",
  },
  payment_reminder: {
    push: "bookingReminderPush",
    sms: "bookingReminderSms",
    email: "bookingConfirmedEmail",
  },
  dispute_opened: {
    push: "bookingConfirmedPush",
  },
  verification_result: {
    push: "bookingConfirmedPush",
    email: "bookingConfirmedEmail",
  },
  marketing: {
    push: "marketingPush",
    email: "marketingEmail",
  },
  admin_new_signup: {},
  admin_identity_verification_request: {},
  admin_service_verification_request: {},
  admin_new_booking: {},
  admin_booking_cancelled: {},
};

const CACHE_TTL_MS = 60_000;

const cache = new Map<string, { prefs: NotificationPrefs; expiresAt: number }>();

const getPrefs = async (userId: string): Promise<NotificationPrefs | null> => {
  const cached = cache.get(userId);
  if (cached && cached.expiresAt > Date.now()) return cached.prefs;

  try {
    const res = await fetch(
      `${config.identityServiceUrl}/internal/users/${userId}/notification-prefs`,
      {
        headers: { "x-service-token": config.internalServiceToken },
      },
    );
    if (!res.ok) throw new Error(`identity returned ${res.status}`);
    const json = (await res.json()) as { data?: NotificationPrefs };
    if (!json.data) return null;

    cache.set(userId, { prefs: json.data, expiresAt: Date.now() + CACHE_TTL_MS });
    return json.data;
  } catch (error) {
    console.error(
      `[Prefs] Failed to fetch notification prefs for ${userId}, failing open:`,
      error,
    );
    return null;
  }
};

export const isChannelEnabled = async (
  userId: string,
  type: NotificationType,
  channel: NotificationChannel,
): Promise<boolean> => {
  const prefs = await getPrefs(userId);
  if (!prefs) return true;

  const flag = TYPE_CHANNEL_FLAGS[type]?.[channel];
  if (!flag) return true;
  return prefs[flag] ?? true;
};