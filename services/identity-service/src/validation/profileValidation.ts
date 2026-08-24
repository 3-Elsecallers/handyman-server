import { z } from "zod";

export const updateProfileSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  phone: z.string().optional(),
});

export const updateNotificationPrefsSchema = z.object({
  bookingConfirmedPush: z.boolean().optional(),
  bookingConfirmedEmail: z.boolean().optional(),
  bookingReminderPush: z.boolean().optional(),
  bookingReminderSms: z.boolean().optional(),
  reviewPush: z.boolean().optional(),
  paymentReceivedEmail: z.boolean().optional(),
  marketingPush: z.boolean().optional(),
  marketingEmail: z.boolean().optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type UpdateNotificationPrefsInput = z.infer<typeof updateNotificationPrefsSchema>;
