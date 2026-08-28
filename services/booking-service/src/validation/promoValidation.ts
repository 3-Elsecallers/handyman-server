import { z } from "zod";

export const createPromoSchema = z.object({
  code: z.string().min(3).max(50).regex(/^[a-zA-Z0-9_-]+$/, "Code must be alphanumeric, underscore or hyphen"),
  description: z.string().max(500).optional(),
  discountPct: z.number().min(0).max(100).optional(),
  discountAmt: z.number().min(0).optional(),
  maxUses: z.number().int().min(1).optional(),
  expiresAt: z.string().datetime().optional(),
}).refine(
  (data) => (data.discountPct == null) !== (data.discountAmt == null),
  { message: "Provide exactly one of discountPct or discountAmt" },
);

export const updatePromoSchema = z.object({
  description: z.string().max(500).optional(),
  discountPct: z.number().min(0).max(100).optional(),
  discountAmt: z.number().min(0).optional(),
  maxUses: z.number().int().min(1).optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  isActive: z.boolean().optional(),
});

export const listPromosQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreatePromoInput = z.infer<typeof createPromoSchema>;
export type UpdatePromoInput = z.infer<typeof updatePromoSchema>;
export type ListPromosQueryInput = z.infer<typeof listPromosQuerySchema>;
