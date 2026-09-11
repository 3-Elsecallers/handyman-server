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
        fileSize: z.number().int().min(1),
        mimeType: z.string().min(1),
        category: z.string().min(1).max(100),
        requirementId: z.string().uuid().optional(),
        serviceRequirementId: z.string().uuid().optional(),
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

export const submitAttestationsSchema = z
  .object({
    attestations: z
      .array(
        z
          .object({
            requirementId: z.string().uuid().optional(),
            serviceRequirementId: z.string().uuid().optional(),
            answer: z.string().min(1).max(1000),
          })
          .refine(
            (item) => !!item.requirementId || !!item.serviceRequirementId,
            { message: "Each attestation must reference a requirement or a service requirement" },
          ),
      )
      .default([]),
    questions: z
      .array(
        z
          .object({
            questionId: z.string().uuid().optional(),
            serviceQuestionId: z.string().uuid().optional(),
            answer: z.string().min(1).max(1000),
          })
          .refine(
            (item) => !!item.questionId || !!item.serviceQuestionId,
            { message: "Each question answer must reference a question or a service question" },
          ),
      )
      .default([]),
  })
  .refine((data) => data.attestations.length > 0 || data.questions.length > 0, {
    message: "At least one attestation or question answer is required",
  });

export type SubmitAttestationsInput = z.infer<typeof submitAttestationsSchema>;
