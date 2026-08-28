"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateAddressSchema = exports.createAddressSchema = exports.addressTypeSchema = void 0;
const zod_1 = require("zod");
exports.addressTypeSchema = zod_1.z.enum(["home", "office", "other"]);
exports.createAddressSchema = zod_1.z.object({
    label: zod_1.z.string().min(1).max(50),
    addressType: exports.addressTypeSchema.default("home"),
    region: zod_1.z.string().min(1).max(100),
    district: zod_1.z.string().min(1).max(100),
    town: zod_1.z.string().min(1).max(100),
    streetAndHouseNumber: zod_1.z.string().max(200).optional(),
    landmark: zod_1.z.string().max(200).optional(),
    digitalAddress: zod_1.z.string().max(30).optional(),
    directions: zod_1.z.string().max(500).optional(),
    contactName: zod_1.z.string().min(1).max(100),
    contactPhone: zod_1.z.string().min(1).max(30),
    country: zod_1.z.string().max(100).default("GH"),
    lat: zod_1.z.number().min(-90).max(90).optional(),
    lng: zod_1.z.number().min(-180).max(180).optional(),
    isDefault: zod_1.z.boolean().default(false),
});
exports.updateAddressSchema = exports.createAddressSchema.partial();
//# sourceMappingURL=addressValidation.js.map