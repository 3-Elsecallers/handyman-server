"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyEmailSchema = exports.resetPasswordSchema = exports.forgotPasswordSchema = exports.socialAuthSchema = exports.loginSchema = exports.registerSchema = void 0;
const zod_1 = require("zod");
exports.registerSchema = zod_1.z.object({
    email: zod_1.z.email("Invalid email format"),
    password: zod_1.z
        .string()
        .min(8, "Password must be at least 8 characters")
        .regex(/[A-Z]/, "Password must contain an uppercase letter")
        .regex(/[0-9]/, "Password must contain a number"),
    firstName: zod_1.z.string().min(1, "First name is required").max(100),
    lastName: zod_1.z.string().min(1, "Last name is required").max(100),
    phone: zod_1.z.string().optional(),
    role: zod_1.z.enum(["customer", "provider"]).default("customer"),
});
exports.loginSchema = zod_1.z.object({
    email: zod_1.z.email(),
    password: zod_1.z.string().min(1, "Password is required"),
});
exports.socialAuthSchema = zod_1.z.object({
    provider: zod_1.z.enum(["google", "apple"]),
    token: zod_1.z.string().min(1, "OAuth token is required"),
    email: zod_1.z.email().optional(),
    firstName: zod_1.z.string().optional(),
    lastName: zod_1.z.string().optional(),
});
exports.forgotPasswordSchema = zod_1.z.object({
    email: zod_1.z.email(),
});
exports.resetPasswordSchema = zod_1.z.object({
    token: zod_1.z.string().min(1),
    password: zod_1.z
        .string()
        .min(8)
        .regex(/[A-Z]/)
        .regex(/[0-9]/),
});
exports.verifyEmailSchema = zod_1.z.object({
    token: zod_1.z.string().min(1),
});
//# sourceMappingURL=authValidation.js.map