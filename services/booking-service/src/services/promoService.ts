import { prisma } from "../db/prisma";
import { AppError } from "../middlewares/errorHandler.middleware";
import type { CreatePromoInput, UpdatePromoInput } from "../validation/promoValidation";

export const validatePromoCode = async (
  code: string,
  userId: string,
  subtotal: number,
) => {
  const promo = await prisma.promoCode.findUnique({ where: { code } });
  if (!promo) throw new AppError(404, "Promo code not found");
  if (!promo.isActive) throw new AppError(400, "Promo code is inactive");
  if (promo.expiresAt && promo.expiresAt < new Date()) {
    throw new AppError(400, "Promo code has expired");
  }
  if (promo.maxUses != null && promo.usedCount >= promo.maxUses) {
    throw new AppError(400, "Promo code has reached its usage limit");
  }

  const existingUsage = await prisma.promoUsage.findFirst({
    where: { userId, promoCodeId: promo.id, bookingId: { not: null } },
    include: { promoCode: true },
  });
  if (existingUsage && existingUsage.bookingId) {
    const booking = await prisma.booking.findUnique({
      where: { id: existingUsage.bookingId },
    });
    if (booking && booking.status !== "cancelled") {
      throw new AppError(400, "Promo code already used");
    }
  }

  let discount = 0;
  if (promo.discountPct != null) {
    discount = Math.round((subtotal * promo.discountPct) / 100 * 100) / 100;
  } else if (promo.discountAmt != null) {
    discount = Math.min(promo.discountAmt, subtotal);
  }

  return { promo, discount };
};

export const claimPromoUsage = async (
  promoCodeId: string,
  userId: string,
  bookingId: string,
) => {
  await prisma.$transaction([
    prisma.promoCode.update({
      where: { id: promoCodeId },
      data: { usedCount: { increment: 1 } },
    }),
    prisma.promoUsage.create({
      data: { promoCodeId, userId, bookingId },
    }),
  ]);
};

export const listPromos = async (page: number, limit: number) => {
  const [items, total] = await Promise.all([
    prisma.promoCode.findMany({
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: { _count: { select: { usages: true } } },
    }),
    prisma.promoCode.count(),
  ]);
  return { items, total, page, limit, pages: Math.ceil(total / limit) };
};

export const createPromo = async (input: CreatePromoInput) => {
  const existing = await prisma.promoCode.findUnique({ where: { code: input.code } });
  if (existing) throw new AppError(409, "Promo code already exists");

  return prisma.promoCode.create({
    data: {
      ...input,
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined,
    },
  });
};

export const updatePromo = async (id: string, input: UpdatePromoInput) => {
  const promo = await prisma.promoCode.findUnique({ where: { id } });
  if (!promo) throw new AppError(404, "Promo code not found");

  return prisma.promoCode.update({
    where: { id },
    data: {
      ...input,
      expiresAt: input.expiresAt === null ? null : input.expiresAt ? new Date(input.expiresAt) : undefined,
    },
  });
};

export const deletePromo = async (id: string) => {
  const promo = await prisma.promoCode.findUnique({ where: { id } });
  if (!promo) throw new AppError(404, "Promo code not found");
  await prisma.promoCode.delete({ where: { id } });
};
