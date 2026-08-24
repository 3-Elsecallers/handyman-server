import { prisma } from "../db/prisma";
import { AppError } from "../middlewares/errorHandler.middleware";
import { publishEvent } from "../utils/kafka";

export const getVerificationQueue = async (page = 1, limit = 20) => {
  const skip = (page - 1) * limit;

  const [providers, total] = await Promise.all([
    prisma.providerProfile.findMany({
      where: { status: "pending_review" },
      orderBy: { createdAt: "asc" },
      skip,
      take: limit,
    }),
    prisma.providerProfile.count({ where: { status: "pending_review" } }),
  ]);

  return { providers, total, page, limit, totalPages: Math.ceil(total / limit) };
};

export const verifyProvider = async (
  providerId: string,
  approved: boolean,
  adminId: string,
) => {
  const profile = await prisma.providerProfile.findUnique({ where: { id: providerId } });
  if (!profile) throw new AppError(404, "Provider not found");

  const updated = await prisma.providerProfile.update({
    where: { id: providerId },
    data: {
      verified: approved,
      status: approved ? "active" : "suspended",
    },
  });

  await prisma.auditLog.create({
    data: {
      actorId: adminId,
      action: approved ? "provider_verified" : "provider_rejected",
      targetType: "provider",
      targetId: providerId,
    },
  });

  if (approved) {
    await publishEvent("provider.verified", providerId, {
      providerId,
      adminId,
    });
  }

  return updated;
};

export const createCategory = async (
  input: { name: string; slug: string; description?: string; iconUrl?: string; sortOrder?: number },
  adminId: string,
) => {
  const existing = await prisma.serviceCategory.findUnique({ where: { slug: input.slug } });
  if (existing) throw new AppError(409, "Category slug already exists");

  const category = await prisma.serviceCategory.create({ data: input });

  await prisma.auditLog.create({
    data: {
      actorId: adminId,
      action: "category_created",
      targetType: "category",
      targetId: category.id,
    },
  });

  return category;
};

export const updateCategory = async (
  id: string,
  input: Record<string, unknown>,
  adminId: string,
) => {
  const category = await prisma.serviceCategory.findUnique({ where: { id } });
  if (!category) throw new AppError(404, "Category not found");

  const updated = await prisma.serviceCategory.update({ where: { id }, data: input });

  await prisma.auditLog.create({
    data: {
      actorId: adminId,
      action: "category_updated",
      targetType: "category",
      targetId: id,
      metadata: { fields: Object.keys(input) },
    },
  });

  return updated;
};

export const createService = async (
  input: {
    categoryId: string; name: string; slug: string;
    description?: string; basePrice: number; durationMins: number;
    imageUrl?: string; sortOrder?: number;
  },
  adminId: string,
) => {
  const category = await prisma.serviceCategory.findUnique({ where: { id: input.categoryId } });
  if (!category) throw new AppError(404, "Category not found");

  const existing = await prisma.service.findUnique({ where: { slug: input.slug } });
  if (existing) throw new AppError(409, "Service slug already exists");

  const service = await prisma.service.create({ data: input });

  await publishEvent("catalog.service.created", service.id, {
    serviceId: service.id,
    name: service.name,
    slug: service.slug,
    categoryId: service.categoryId,
    basePrice: service.basePrice,
  });

  await prisma.auditLog.create({
    data: {
      actorId: adminId,
      action: "service_created",
      targetType: "service",
      targetId: service.id,
    },
  });

  return service;
};

export const updateService = async (
  id: string,
  input: Record<string, unknown>,
  adminId: string,
) => {
  const service = await prisma.service.findUnique({ where: { id } });
  if (!service) throw new AppError(404, "Service not found");

  const updated = await prisma.service.update({ where: { id }, data: input });

  await prisma.auditLog.create({
    data: {
      actorId: adminId,
      action: "service_updated",
      targetType: "service",
      targetId: id,
      metadata: { fields: Object.keys(input) },
    },
  });

  return updated;
};

export const getAuditLog = async (page = 1, limit = 50) => {
  const skip = (page - 1) * limit;

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.auditLog.count(),
  ]);

  return { logs, total, page, limit, totalPages: Math.ceil(total / limit) };
};
