import { prisma } from "../db/prisma";
import type { UpdateNotificationPrefsInput } from "../validation/profileValidation";

const defaultPrefs = {
  bookingConfirmedPush: true,
  bookingConfirmedEmail: true,
  bookingReminderPush: true,
  bookingReminderSms: true,
  reviewPush: true,
  paymentReceivedEmail: true,
  marketingPush: false,
  marketingEmail: false,
};

export const getPreferences = async (userId: string) => {
  let prefs = await prisma.userNotificationPreferences.findUnique({
    where: { userId },
  });

  if (!prefs) {
    prefs = await prisma.userNotificationPreferences.create({
      data: { userId, ...defaultPrefs },
    });
  }

  return prefs;
};

export const updatePreferences = async (
  userId: string,
  input: UpdateNotificationPrefsInput,
) => {
  await prisma.userNotificationPreferences.upsert({
    where: { userId },
    create: { userId, ...defaultPrefs, ...input },
    update: input,
  });

  return getPreferences(userId);
};
