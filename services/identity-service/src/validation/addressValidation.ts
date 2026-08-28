import { z } from "zod";

export const addressTypeSchema = z.enum(["home", "office", "other"]);

export const createAddressSchema = z.object({
  label: z.string().min(1).max(50),
  addressType: addressTypeSchema.default("home"),
  region: z.string().min(1).max(100),
  district: z.string().min(1).max(100),
  town: z.string().min(1).max(100),
  streetAndHouseNumber: z.string().max(200).optional(),
  landmark: z.string().max(200).optional(),
  digitalAddress: z.string().max(30).optional(),
  directions: z.string().max(500).optional(),
  contactName: z.string().min(1).max(100),
  contactPhone: z.string().min(1).max(30),
  country: z.string().max(100).default("GH"),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  isDefault: z.boolean().default(false),
});

export const updateAddressSchema = createAddressSchema.partial();

export type CreateAddressInput = z.infer<typeof createAddressSchema>;
export type UpdateAddressInput = z.infer<typeof updateAddressSchema>;
