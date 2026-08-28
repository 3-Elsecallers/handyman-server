"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUsersByIds = exports.getUserById = exports.uploadAvatar = exports.updateProfile = exports.getProfile = void 0;
const prisma_1 = require("../db/prisma");
const errorHandler_middleware_1 = require("../middlewares/errorHandler.middleware");
const kafka_1 = require("../utils/kafka");
const getProfile = async (userId) => {
    const user = await prisma_1.prisma.user.findUnique({ where: { id: userId } });
    if (!user)
        throw new errorHandler_middleware_1.AppError(404, "User not found");
    const { passwordHash, ...profile } = user;
    return profile;
};
exports.getProfile = getProfile;
const updateProfile = async (userId, input) => {
    const user = await prisma_1.prisma.user.findUnique({ where: { id: userId } });
    if (!user)
        throw new errorHandler_middleware_1.AppError(404, "User not found");
    const updated = await prisma_1.prisma.user.update({
        where: { id: userId },
        data: input,
    });
    await (0, kafka_1.publishEvent)("identity.user.updated", userId, {
        userId,
        fields: Object.keys(input),
    });
    const { passwordHash, ...profile } = updated;
    return profile;
};
exports.updateProfile = updateProfile;
const uploadAvatar = async (userId, avatarUrl) => {
    const user = await prisma_1.prisma.user.findUnique({ where: { id: userId } });
    if (!user)
        throw new errorHandler_middleware_1.AppError(404, "User not found");
    const updated = await prisma_1.prisma.user.update({
        where: { id: userId },
        data: { avatarUrl },
    });
    await (0, kafka_1.publishEvent)("identity.user.updated", userId, {
        userId,
        fields: ["avatarUrl"],
    });
    return { avatarUrl: updated.avatarUrl };
};
exports.uploadAvatar = uploadAvatar;
const getUserById = async (userId) => {
    const user = await prisma_1.prisma.user.findUnique({ where: { id: userId } });
    if (!user)
        throw new errorHandler_middleware_1.AppError(404, "User not found");
    return {
        id: user.id,
        email: user.email,
        phone: user.phone,
        firstName: user.firstName,
        lastName: user.lastName,
        avatarUrl: user.avatarUrl,
        role: user.role,
        createdAt: user.createdAt,
    };
};
exports.getUserById = getUserById;
const getUsersByIds = async (ids) => {
    const users = await prisma_1.prisma.user.findMany({
        where: { id: { in: ids } },
        select: {
            id: true,
            email: true,
            phone: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
            role: true,
            createdAt: true,
        },
    });
    return users;
};
exports.getUsersByIds = getUsersByIds;
//# sourceMappingURL=userService.js.map