"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listPromosQuerySchema = exports.updatePromoSchema = exports.createPromoSchema = void 0;
const zod_1 = require("zod");
exports.createPromoSchema = zod_1.z.object({
    code: zod_1.z.string().min(3).max(50).regex(/^[a-zA-Z0-9_-]+$/, "Code must be alphanumeric, underscore or hyphen"),
    description: zod_1.z.string().max(500).optional(),
    discountPct: zod_1.z.number().min(0).max(100).optional(),
    discountAmt: zod_1.z.number().min(0).optional(),
    maxUses: zod_1.z.number().int().min(1).optional(),
    expiresAt: zod_1.z.string().datetime().optional(),
}).refine((data) => (data.discountPct == null) !== (data.discountAmt == null), { message: "Provide exactly one of discountPct or discountAmt" });
exports.updatePromoSchema = zod_1.z.object({
    description: zod_1.z.string().max(500).optional(),
    discountPct: zod_1.z.number().min(0).max(100).optional(),
    discountAmt: zod_1.z.number().min(0).optional(),
    maxUses: zod_1.z.number().int().min(1).optional(),
    expiresAt: zod_1.z.string().datetime().nullable().optional(),
    isActive: zod_1.z.boolean().optional(),
});
exports.listPromosQuerySchema = zod_1.z.object({
    page: zod_1.z.coerce.number().int().min(1).default(1),
    limit: zod_1.z.coerce.number().int().min(1).max(100).default(20),
});
//# sourceMappingURL=promoValidation.js.map