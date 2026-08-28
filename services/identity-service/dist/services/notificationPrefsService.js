"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updatePreferences = exports.getPreferences = void 0;
const prisma_1 = require("../db/prisma");
const defaultPrefs = {
    bookingConfirmedPush: true,
    bookingConfirmedEmail: true,
    bookingReminderPush: true,
    bookingReminderSms: true,
    reviewPush: true,
    paymentReceivedEmail: true,
    marketingPush: false,
    marketingEmail: false,
};
const getPreferences = async (userId) => {
    let prefs = await prisma_1.prisma.userNotificationPreferences.findUnique({
        where: { userId },
    });
    if (!prefs) {
        prefs = await prisma_1.prisma.userNotificationPreferences.create({
            data: { userId, ...defaultPrefs },
        });
    }
    return prefs;
};
exports.getPreferences = getPreferences;
const updatePreferences = async (userId, input) => {
    await prisma_1.prisma.userNotificationPreferences.upsert({
        where: { userId },
        create: { userId, ...defaultPrefs, ...input },
        update: input,
    });
    return (0, exports.getPreferences)(userId);
};
exports.updatePreferences = updatePreferences;
//# sourceMappingURL=notificationPrefsService.js.map