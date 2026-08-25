import { z } from "zod";

export const updateProfileSchema = z.object({
  bio: z.string().max(1000).optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  serviceAreaRadiusKm: z.number().min(1).max(100).optional(),
});

export const addServiceSchema = z.object({
  serviceId: z.string().uuid(),
  customPrice: z.number().min(0).optional(),
});

export const updateServiceSchema = z.object({
  customPrice: z.number().min(0).optional(),
  isActive: z.boolean().optional(),
});

export const uploadDocumentsSchema = z.object({
  documentUrls: z.array(z.string().url()).min(1).max(5),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type AddServiceInput = z.infer<typeof addServiceSchema>;

export const requestUploadUrlsSchema = z.object({
  files: z
    .array(
      z.object({
        fileName: z.string().min(1).max(255),
        fileSize: z.number().int().min(1).max(5 * 1024 * 1024),
        mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
        category: z.enum(["selfie", "ghana_card", "additional"]),
      }),
    )
    .min(1)
    .max(10),
});

export const confirmUploadsSchema = z.object({
  documents: z
    .array(
      z.object({
        id: z.string().uuid(),
      }),
    )
    .min(1)
    .max(10),
});

export type RequestUploadUrlsInput = z.infer<typeof requestUploadUrlsSchema>;
export type ConfirmUploadsInput = z.infer<typeof confirmUploadsSchema>;
