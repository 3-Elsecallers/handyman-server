import { z } from "zod";

export const submitReviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(2000).optional(),
  photoUrls: z.array(z.string().url()).max(5).default([]),
});

export const respondToReviewSchema = z.object({
  response: z.string().min(1).max(2000),
});

export const moderateReviewSchema = z.object({
  status: z.enum(["visible", "flagged", "removed"]),
});

export const searchProvidersSchema = z.object({
  q: z.string().optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  radiusKm: z.coerce.number().min(1).max(100).default(25),
  categoryId: z.string().uuid().optional(),
  serviceId: z.string().uuid().optional(),
  minRating: z.coerce.number().min(0).max(5).optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  verified: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  sortBy: z.enum(["distance", "rating", "price", "experience"]).default("rating"),
});

export const matchProvidersSchema = z.object({
  serviceId: z.string().uuid(),
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  scheduledAt: z.string().datetime(),
  durationMins: z.number().int().min(15).max(480),
  limit: z.number().int().min(1).max(20).default(5),
});

export const validateAvailabilitySchema = z.object({
  scheduledAt: z.string().datetime(),
  durationMins: z.number().int().min(15).max(480),
});

export type SearchProvidersInput = z.infer<typeof searchProvidersSchema>;
export type MatchProvidersInput = z.infer<typeof matchProvidersSchema>;
