import { z } from "zod";

const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const availabilitySlotSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string().regex(timeRegex, "Time must be HH:MM (24h)"),
  endTime: z.string().regex(timeRegex, "Time must be HH:MM (24h)"),
}).refine(
  (data) => data.startTime < data.endTime,
  { message: "Start time must be before end time" },
);

export const updateAvailabilitySchema = z.object({
  slots: z.array(availabilitySlotSchema).max(14),
});

export const createBlockedSlotSchema = z.object({
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  reason: z.string().max(200).optional(),
}).refine(
  (data) => new Date(data.startAt) < new Date(data.endAt),
  { message: "Start must be before end" },
);

export type UpdateAvailabilityInput = z.infer<typeof updateAvailabilitySchema>;
export type CreateBlockedSlotInput = z.infer<typeof createBlockedSlotSchema>;
