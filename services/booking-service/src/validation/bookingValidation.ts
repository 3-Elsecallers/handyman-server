import { z } from "zod";

export const addressSchema = z.object({
  locationLine1: z.string().min(1).max(200),
  locationLine2: z.string().max(200).optional(),
  locationCity: z.string().min(1).max(100),
  locationState: z.string().min(1).max(100),
  locationPostal: z.string().min(1).max(20),
  locationLat: z.number().min(-90).max(90),
  locationLng: z.number().min(-180).max(180),
});

export const instantBookingSchema = z.object({
  type: z.literal("instant").optional().default("instant"),
  serviceId: z.string().uuid(),
  providerId: z.string().uuid(),
  scheduledAt: z.string().datetime(),
  complexity: z.enum(["standard", "moderate", "complex"]).default("standard"),
  promoCode: z.string().max(50).optional(),
  notes: z.string().max(2000).optional(),
  ...addressSchema.shape,
});

export const requestBookingSchema = z.object({
  type: z.literal("request"),
  serviceId: z.string().uuid(),
  scheduledWindowStart: z.string().datetime(),
  scheduledWindowEnd: z.string().datetime(),
  complexity: z.enum(["standard", "moderate", "complex"]).default("standard"),
  description: z.string().min(1).max(4000),
  ...addressSchema.shape,
});

export const cancelBookingSchema = z.object({
  reason: z.string().max(500).optional(),
});

export const estimateBookingSchema = z.object({
  type: z.enum(["instant", "request"]).optional(),
  serviceId: z.string().uuid(),
  providerId: z.string().uuid().optional(),
  scheduledAt: z.string().datetime().optional(),
  complexity: z.enum(["standard", "moderate", "complex"]).default("standard"),
  promoCode: z.string().max(50).optional(),
  locationLat: z.number().min(-90).max(90),
  locationLng: z.number().min(-180).max(180),
});

export const disputeBookingSchema = z.object({
  reason: z.string().min(1).max(2000),
});

export const listBookingsQuerySchema = z.object({
  status: z.enum(["pending", "confirmed", "in_progress", "completed", "cancelled", "disputed"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const adminListBookingsQuerySchema = z.object({
  status: z.enum(["pending", "confirmed", "in_progress", "completed", "cancelled", "disputed"]).optional(),
  search: z.string().optional(),
  customerId: z.string().uuid().optional(),
  providerId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const resolveDisputeSchema = z.object({
  resolveTo: z.enum(["completed", "cancelled"]),
  note: z.string().max(2000).optional(),
});

export type InstantBookingInput = z.infer<typeof instantBookingSchema>;
export type RequestBookingInput = z.infer<typeof requestBookingSchema>;
export type CancelBookingInput = z.infer<typeof cancelBookingSchema>;
export type EstimateBookingInput = z.infer<typeof estimateBookingSchema>;
export type DisputeBookingInput = z.infer<typeof disputeBookingSchema>;
export type ListBookingsQueryInput = z.infer<typeof listBookingsQuerySchema>;
export type AdminListBookingsQueryInput = z.infer<typeof adminListBookingsQuerySchema>;
export type ResolveDisputeInput = z.infer<typeof resolveDisputeSchema>;
