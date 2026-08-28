"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateNotificationPrefsSchema = exports.updateProfileSchema = void 0;
const zod_1 = require("zod");
exports.updateProfileSchema = zod_1.z.object({
    firstName: zod_1.z.string().min(1).max(100).optional(),
    lastName: zod_1.z.string().min(1).max(100).optional(),
    phone: zod_1.z.string().optional(),
});
exports.updateNotificationPrefsSchema = zod_1.z.object({
    bookingConfirmedPush: zod_1.z.boolean().optional(),
    bookingConfirmedEmail: zod_1.z.boolean().optional(),
    bookingReminderPush: zod_1.z.boolean().optional(),
    bookingReminderSms: zod_1.z.boolean().optional(),
    reviewPush: zod_1.z.boolean().optional(),
    paymentReceivedEmail: zod_1.z.boolean().optional(),
    marketingPush: zod_1.z.boolean().optional(),
    marketingEmail: zod_1.z.boolean().optional(),
});
//# sourceMappingURL=profileValidation.js.map