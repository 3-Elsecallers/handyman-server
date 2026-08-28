import { z } from "zod";

export const createCategorySchema = z.object({
  name: z.string().min(1).max(100),
  // slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
  description: z.string().max(500).optional(),
  iconUrl: z.string().url().optional(),
  // sortOrder: z.number().int().min(0).default(0),
});

export const updateCategorySchema = createCategorySchema.partial();

export const createServiceSchema = z.object({
  categoryId: z.string().uuid(),
  name: z.string().min(1).max(100),
  // slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
  description: z.string().max(1000).optional(),
  basePrice: z.number().min(0),
  durationMins: z.number().int().min(15).max(480),
  imageUrl: z.string().url().optional(),
  // sortOrder: z.number().int().min(0).default(0),
});

export const updateServiceSchema = createServiceSchema.partial().omit({ categoryId: true });

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type CreateServiceInput = z.infer<typeof createServiceSchema>;
