"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveDisputeSchema = exports.adminListBookingsQuerySchema = exports.listBookingsQuerySchema = exports.disputeBookingSchema = exports.cancelBookingSchema = exports.requestBookingSchema = exports.instantBookingSchema = exports.addressSchema = void 0;
const zod_1 = require("zod");
exports.addressSchema = zod_1.z.object({
    locationLine1: zod_1.z.string().min(1).max(200),
    locationLine2: zod_1.z.string().max(200).optional(),
    locationCity: zod_1.z.string().min(1).max(100),
    locationState: zod_1.z.string().min(1).max(100),
    locationPostal: zod_1.z.string().min(1).max(20),
    locationLat: zod_1.z.number().min(-90).max(90),
    locationLng: zod_1.z.number().min(-180).max(180),
});
exports.instantBookingSchema = zod_1.z.object({
    type: zod_1.z.literal("instant").optional().default("instant"),
    serviceId: zod_1.z.string().uuid(),
    providerId: zod_1.z.string().uuid(),
    scheduledAt: zod_1.z.string().datetime(),
    complexity: zod_1.z.enum(["standard", "moderate", "complex"]).default("standard"),
    promoCode: zod_1.z.string().max(50).optional(),
    notes: zod_1.z.string().max(2000).optional(),
    ...exports.addressSchema.shape,
});
exports.requestBookingSchema = zod_1.z.object({
    type: zod_1.z.literal("request"),
    serviceId: zod_1.z.string().uuid(),
    scheduledWindowStart: zod_1.z.string().datetime(),
    scheduledWindowEnd: zod_1.z.string().datetime(),
    complexity: zod_1.z.enum(["standard", "moderate", "complex"]).default("standard"),
    description: zod_1.z.string().min(1).max(4000),
    ...exports.addressSchema.shape,
});
exports.cancelBookingSchema = zod_1.z.object({
    reason: zod_1.z.string().max(500).optional(),
});
exports.disputeBookingSchema = zod_1.z.object({
    reason: zod_1.z.string().min(1).max(2000),
});
exports.listBookingsQuerySchema = zod_1.z.object({
    status: zod_1.z.enum(["pending", "confirmed", "in_progress", "completed", "cancelled", "disputed"]).optional(),
    page: zod_1.z.coerce.number().int().min(1).default(1),
    limit: zod_1.z.coerce.number().int().min(1).max(100).default(20),
});
exports.adminListBookingsQuerySchema = zod_1.z.object({
    status: zod_1.z.enum(["pending", "confirmed", "in_progress", "completed", "cancelled", "disputed"]).optional(),
    search: zod_1.z.string().optional(),
    customerId: zod_1.z.string().uuid().optional(),
    providerId: zod_1.z.string().uuid().optional(),
    page: zod_1.z.coerce.number().int().min(1).default(1),
    limit: zod_1.z.coerce.number().int().min(1).max(100).default(20),
});
exports.resolveDisputeSchema = zod_1.z.object({
    resolveTo: zod_1.z.enum(["completed", "cancelled"]),
    note: zod_1.z.string().max(2000).optional(),
});
//# sourceMappingURL=bookingValidation.js.map