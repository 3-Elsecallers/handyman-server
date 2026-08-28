"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deletePromo = exports.updatePromo = exports.createPromo = exports.listPromos = exports.claimPromoUsage = exports.validatePromoCode = void 0;
const prisma_1 = require("../db/prisma");
const errorHandler_middleware_1 = require("../middlewares/errorHandler.middleware");
const validatePromoCode = async (code, userId, subtotal) => {
    const promo = await prisma_1.prisma.promoCode.findUnique({ where: { code } });
    if (!promo)
        throw new errorHandler_middleware_1.AppError(404, "Promo code not found");
    if (!promo.isActive)
        throw new errorHandler_middleware_1.AppError(400, "Promo code is inactive");
    if (promo.expiresAt && promo.expiresAt < new Date()) {
        throw new errorHandler_middleware_1.AppError(400, "Promo code has expired");
    }
    if (promo.maxUses != null && promo.usedCount >= promo.maxUses) {
        throw new errorHandler_middleware_1.AppError(400, "Promo code has reached its usage limit");
    }
    const existingUsage = await prisma_1.prisma.promoUsage.findFirst({
        where: { userId, promoCodeId: promo.id, bookingId: { not: null } },
        include: { promoCode: true },
    });
    if (existingUsage && existingUsage.bookingId) {
        const booking = await prisma_1.prisma.booking.findUnique({
            where: { id: existingUsage.bookingId },
        });
        if (booking && booking.status !== "cancelled") {
            throw new errorHandler_middleware_1.AppError(400, "Promo code already used");
        }
    }
    let discount = 0;
    if (promo.discountPct != null) {
        discount = Math.round((subtotal * promo.discountPct) / 100 * 100) / 100;
    }
    else if (promo.discountAmt != null) {
        discount = Math.min(promo.discountAmt, subtotal);
    }
    return { promo, discount };
};
exports.validatePromoCode = validatePromoCode;
const claimPromoUsage = async (promoCodeId, userId, bookingId) => {
    await prisma_1.prisma.$transaction([
        prisma_1.prisma.promoCode.update({
            where: { id: promoCodeId },
            data: { usedCount: { increment: 1 } },
        }),
        prisma_1.prisma.promoUsage.create({
            data: { promoCodeId, userId, bookingId },
        }),
    ]);
};
exports.claimPromoUsage = claimPromoUsage;
const listPromos = async (page, limit) => {
    const [items, total] = await Promise.all([
        prisma_1.prisma.promoCode.findMany({
            orderBy: { createdAt: "desc" },
            skip: (page - 1) * limit,
            take: limit,
            include: { _count: { select: { usages: true } } },
        }),
        prisma_1.prisma.promoCode.count(),
    ]);
    return { items, total, page, limit, pages: Math.ceil(total / limit) };
};
exports.listPromos = listPromos;
const createPromo = async (input) => {
    const existing = await prisma_1.prisma.promoCode.findUnique({ where: { code: input.code } });
    if (existing)
        throw new errorHandler_middleware_1.AppError(409, "Promo code already exists");
    return prisma_1.prisma.promoCode.create({
        data: {
            ...input,
            expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined,
        },
    });
};
exports.createPromo = createPromo;
const updatePromo = async (id, input) => {
    const promo = await prisma_1.prisma.promoCode.findUnique({ where: { id } });
    if (!promo)
        throw new errorHandler_middleware_1.AppError(404, "Promo code not found");
    return prisma_1.prisma.promoCode.update({
        where: { id },
        data: {
            ...input,
            expiresAt: input.expiresAt === null ? null : input.expiresAt ? new Date(input.expiresAt) : undefined,
        },
    });
};
exports.updatePromo = updatePromo;
const deletePromo = async (id) => {
    const promo = await prisma_1.prisma.promoCode.findUnique({ where: { id } });
    if (!promo)
        throw new errorHandler_middleware_1.AppError(404, "Promo code not found");
    await prisma_1.prisma.promoCode.delete({ where: { id } });
};
exports.deletePromo = deletePromo;
//# sourceMappingURL=promoService.js.map