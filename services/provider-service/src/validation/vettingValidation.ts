import { z } from "zod";

export const createRequirementSchema = z.object({
  type: z.enum(["document", "attestation", "certification"]),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  isRequired: z.boolean().default(true),
  acceptedMimeTypes: z.array(z.string()).default([]),
  maxFileSizeMb: z.number().int().min(1).max(50).default(10),
  sortOrder: z.number().int().min(0).default(0),
});

export const updateRequirementSchema = createRequirementSchema.partial();

const questionBaseSchema = z.object({
  question: z.string().min(1).max(500),
  type: z.enum(["yes_no", "text", "single_choice", "multiple_choice"]),
  options: z.array(z.string().max(100)).default([]),
  isRequired: z.boolean().default(true),
  sortOrder: z.number().int().min(0).default(0),
});

export const createQuestionSchema = questionBaseSchema.refine(
  (data) => {
    if (data.type === "single_choice" || data.type === "multiple_choice") {
      return data.options.length >= 2;
    }
    return true;
  },
  { message: "Choice types require at least 2 options" },
);

export const updateQuestionSchema = questionBaseSchema.partial();

export const createServiceRequirementSchema = z.object({
  type: z.enum(["document", "attestation", "certification"]),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  isRequired: z.boolean().default(true),
  acceptedMimeTypes: z.array(z.string()).default([]),
  maxFileSizeMb: z.number().int().min(1).max(50).default(10),
  sortOrder: z.number().int().min(0).default(0),
});

export const updateServiceRequirementSchema = createServiceRequirementSchema.partial();

export const createServiceQuestionSchema = questionBaseSchema.refine(
  (data) => {
    if (data.type === "single_choice" || data.type === "multiple_choice") {
      return data.options.length >= 2;
    }
    return true;
  },
  { message: "Choice types require at least 2 options" },
);

export const updateServiceQuestionSchema = questionBaseSchema.partial();

export type CreateRequirementInput = z.infer<typeof createRequirementSchema>;
export type UpdateRequirementInput = z.infer<typeof updateRequirementSchema>;
export type CreateQuestionInput = z.infer<typeof createQuestionSchema>;
export type UpdateQuestionInput = z.infer<typeof updateQuestionSchema>;
export type CreateServiceRequirementInput = z.infer<typeof createServiceRequirementSchema>;
export type UpdateServiceRequirementInput = z.infer<typeof updateServiceRequirementSchema>;
export type CreateServiceQuestionInput = z.infer<typeof createServiceQuestionSchema>;
export type UpdateServiceQuestionInput = z.infer<typeof updateServiceQuestionSchema>;
