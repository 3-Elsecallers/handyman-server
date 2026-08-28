"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAuditLog = exports.deleteUser = exports.updateUserStatus = exports.getUserDetail = exports.listUsers = void 0;
const prisma_1 = require("../db/prisma");
const errorHandler_middleware_1 = require("../middlewares/errorHandler.middleware");
const kafka_1 = require("../utils/kafka");
const listUsers = async (query) => {
    const page = query.page || 1;
    const limit = Math.min(query.limit || 20, 100);
    const skip = (page - 1) * limit;
    const where = {};
    if (query.role) {
        where.role = query.role;
    }
    if (query.status) {
        where.status = query.status;
    }
    if (query.search) {
        where.OR = [
            { email: { contains: query.search, mode: "insensitive" } },
            { firstName: { contains: query.search, mode: "insensitive" } },
            { lastName: { contains: query.search, mode: "insensitive" } },
            { phone: { contains: query.search, mode: "insensitive" } },
        ];
    }
    const [users, total] = await Promise.all([
        prisma_1.prisma.user.findMany({
            where,
            skip,
            take: limit,
            select: {
                id: true,
                email: true,
                phone: true,
                firstName: true,
                lastName: true,
                role: true,
                status: true,
                createdAt: true,
            },
            orderBy: { createdAt: "desc" },
        }),
        prisma_1.prisma.user.count({ where }),
    ]);
    return { users, total, page, limit, totalPages: Math.ceil(total / limit) };
};
exports.listUsers = listUsers;
const getUserDetail = async (userId) => {
    const user = await prisma_1.prisma.user.findUnique({
        where: { id: userId },
        select: {
            id: true,
            email: true,
            phone: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
            role: true,
            status: true,
            emailVerified: true,
            phoneVerified: true,
            createdAt: true,
            updatedAt: true,
        },
    });
    if (!user)
        throw new errorHandler_middleware_1.AppError(404, "User not found");
    return user;
};
exports.getUserDetail = getUserDetail;
const updateUserStatus = async (userId, action, adminId) => {
    const user = await prisma_1.prisma.user.findUnique({ where: { id: userId } });
    if (!user)
        throw new errorHandler_middleware_1.AppError(404, "User not found");
    const newStatus = action === "suspend" ? "suspended" : "active";
    const updated = await prisma_1.prisma.user.update({
        where: { id: userId },
        data: { status: newStatus },
        select: { id: true, status: true, updatedAt: true },
    });
    await prisma_1.prisma.auditLog.create({
        data: {
            actorId: adminId,
            action: action === "suspend" ? "user_suspended" : "user_activated",
            targetType: "user",
            targetId: userId,
        },
    });
    if (action === "suspend") {
        await (0, kafka_1.publishEvent)("identity.user.suspended", userId, {
            userId,
            reason: "Suspended by admin",
            adminId,
        });
    }
    return updated;
};
exports.updateUserStatus = updateUserStatus;
const deleteUser = async (userId, adminId) => {
    const user = await prisma_1.prisma.user.findUnique({ where: { id: userId } });
    if (!user)
        throw new errorHandler_middleware_1.AppError(404, "User not found");
    if (user.role === "admin") {
        throw new errorHandler_middleware_1.AppError(400, "Admin users cannot be deleted");
    }
    await prisma_1.prisma.user.delete({ where: { id: userId } });
    await prisma_1.prisma.auditLog.create({
        data: {
            actorId: adminId,
            action: "user_deleted",
            targetType: "user",
            targetId: userId,
            metadata: { email: user.email, role: user.role },
        },
    });
    await (0, kafka_1.publishEvent)("identity.user.deleted", userId, {
        userId,
        adminId,
    });
    return { userId, deletedAt: new Date() };
};
exports.deleteUser = deleteUser;
const getAuditLog = async (page = 1, limit = 50) => {
    const skip = (page - 1) * limit;
    const [logs, total] = await Promise.all([
        prisma_1.prisma.auditLog.findMany({
            orderBy: { createdAt: "desc" },
            skip,
            take: limit,
        }),
        prisma_1.prisma.auditLog.count(),
    ]);
    return { logs, total, page, limit, totalPages: Math.ceil(total / limit) };
};
exports.getAuditLog = getAuditLog;
//# sourceMappingURL=adminService.js.map