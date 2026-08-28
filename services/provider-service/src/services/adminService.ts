import { prisma } from "../db/prisma";
import { AppError } from "../middlewares/errorHandler.middleware";
import { publishEvent } from "../utils/kafka";
import { generateDownloadUrl, getDocumentStream } from "../config/s3";
import { config } from "../config/env";

interface ProviderUserInfo {
  id: string;
  email: string;
  phone: string | null;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  role: string;
  createdAt: string;
}

async function fetchUsersForProviders(userIds: string[]): Promise<Map<string, ProviderUserInfo>> {
  const userMap = new Map<string, ProviderUserInfo>();
  if (userIds.length === 0) return userMap;

  try {
    const idsParam = userIds.join(",");
    const response = await fetch(
      `${config.identityServiceUrl}/internal/users/batch?ids=${idsParam}`,
      {
        headers: {
          "x-service-token": config.internalServiceToken,
        },
      },
    );
    if (response.ok) {
      const data = await response.json() as { data: ProviderUserInfo[] };
      if (Array.isArray(data.data)) {
        for (const user of data.data) {
          userMap.set(user.id, user);
        }
      }
    }
  } catch {
    console.error("[Admin] Failed to fetch user info from identity-service");
  }

  return userMap;
}

async function searchUserIds(query: string): Promise<string[]> {
  try {
    const response = await fetch(
      `${config.identityServiceUrl}/internal/users/search?query=${encodeURIComponent(query)}&limit=50`,
      {
        headers: {
          "x-service-token": config.internalServiceToken,
        },
      },
    );
    if (response.ok) {
      const data = await response.json() as { data: Array<{ id: string }> };
      if (Array.isArray(data.data)) {
        return data.data.map((u) => u.id);
      }
    }
  } catch {
    console.error("[Admin] Failed to search users via identity-service");
  }
  return [];
}

export const listAllProviders = async (query: {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  verificationStatus?: string;
}) => {
  const page = query.page || 1;
  const limit = Math.min(query.limit || 20, 100);
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {};

  if (query.status) {
    where.status = query.status;
  }

  if (query.verificationStatus) {
    where.verificationStatus = query.verificationStatus;
  }

  if (query.search) {
    const orConditions: Record<string, unknown>[] = [
      { bio: { contains: query.search, mode: "insensitive" } },
      { userId: { contains: query.search, mode: "insensitive" } },
    ];

    const matchedUserIds = await searchUserIds(query.search);
    if (matchedUserIds.length > 0) {
      orConditions.push({ userId: { in: matchedUserIds } });
    }

    where.OR = orConditions;
  }

  const [providers, total] = await Promise.all([
    prisma.providerProfile.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        providerDocuments: {
          select: { id: true, status: true },
        },
      },
    }),
    prisma.providerProfile.count({ where }),
  ]);

  const userIds = providers.map((p) => p.userId);
  const userMap = await fetchUsersForProviders(userIds);

  const providersWithUser = providers.map((provider) => ({
    ...provider,
    user: userMap.get(provider.userId) || null,
  }));

  return { providers: providersWithUser, total, page, limit, totalPages: Math.ceil(total / limit) };
};

export const getVerificationQueue = async (page = 1, limit = 20) => {
  const skip = (page - 1) * limit;

  const [providers, total] = await Promise.all([
    prisma.providerProfile.findMany({
      where: { verificationStatus: "pending_review" },
      orderBy: { createdAt: "asc" },
      skip,
      take: limit,
      include: {
        providerDocuments: {
          orderBy: { createdAt: "asc" },
        },
      },
    }),
    prisma.providerProfile.count({ where: { verificationStatus: "pending_review" } }),
  ]);

  return { providers, total, page, limit, totalPages: Math.ceil(total / limit) };
};

export const getVerificationQueueCount = async () => {
  const count = await prisma.providerProfile.count({
    where: { verificationStatus: "pending_review" },
  });
  return { count };
};

export const getProviderDetail = async (providerId: string) => {
  const profile = await prisma.providerProfile.findUnique({
    where: { id: providerId },
    include: {
      services: {
        include: { service: true },
      },
      providerDocuments: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!profile) throw new AppError(404, "Provider not found");

  const userMap = await fetchUsersForProviders([profile.userId]);
  const userInfo = userMap.get(profile.userId) || null;

  return { ...profile, user: userInfo };
};

export const getProviderDocuments = async (providerId: string) => {
  const profile = await prisma.providerProfile.findUnique({
    where: { id: providerId },
    include: {
      providerDocuments: {
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!profile) throw new AppError(404, "Provider not found");
  return profile;
};

export const getDocumentDownloadUrl = async (documentId: string) => {
  const doc = await prisma.providerDocument.findUnique({
    where: { id: documentId },
  });
  if (!doc) throw new AppError(404, "Document not found");

  const url = await generateDownloadUrl(doc.s3Key);
  return { url, document: doc };
};

export const streamDocument = async (documentId: string) => {
  const doc = await prisma.providerDocument.findUnique({
    where: { id: documentId },
  });
  if (!doc) throw new AppError(404, "Document not found");

  try {
    const result = await getDocumentStream(doc.s3Key);
    return { doc, result };
  } catch {
    throw new AppError(404, "File not found in storage");
  }
};

export const verifyProvider = async (
  providerId: string,
  approved: boolean,
  adminId: string,
  rejectionNote?: string,
) => {
  const profile = await prisma.providerProfile.findUnique({ where: { id: providerId } });
  if (!profile) throw new AppError(404, "Provider not found");

  if (!approved && !rejectionNote?.trim()) {
    throw new AppError(400, "Rejection reason is required when rejecting a provider");
  }

  const updated = await prisma.providerProfile.update({
    where: { id: providerId },
    data: {
      verified: approved,
      status: approved ? "active" : "suspended",
      verificationStatus: approved ? "approved" : "rejected",
      rejectionNote: approved ? null : rejectionNote?.trim() || null,
    },
  });

  if (approved) {
    await prisma.providerDocument.updateMany({
      where: { providerId, status: "pending_review" },
      data: { status: "approved" },
    });
  } else {
    await prisma.providerDocument.updateMany({
      where: { providerId, status: "pending_review" },
      data: { status: "rejected", rejectionReason: rejectionNote?.trim() || null },
    });
  }

  await prisma.auditLog.create({
    data: {
      actorId: adminId,
      action: approved ? "provider_verified" : "provider_rejected",
      targetType: "provider",
      targetId: providerId,
      metadata: approved ? undefined : { rejectionNote: rejectionNote?.trim() },
    },
  });

  if (approved) {
    await publishEvent("provider.verified", providerId, {
      providerId,
      adminId,
    });
  } else {
    await publishEvent("provider.rejected", providerId, {
      providerId,
      adminId,
      rejectionNote: rejectionNote?.trim(),
    });
  }

  return updated;
};

export const getProviderReviews = async (providerId: string, page = 1, limit = 20) => {
  const skip = (page - 1) * limit;

  const [reviews, total] = await Promise.all([
    prisma.review.findMany({
      where: { providerId },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.review.count({ where: { providerId } }),
  ]);

  return { reviews, total, page, limit, totalPages: Math.ceil(total / limit) };
};

export const createCategory = async (
  input: { name: string; description?: string; iconUrl?: string; sortOrder?: number },
  adminId: string,
) => {
  const slug = slugify(input.name);

  const existing = await prisma.serviceCategory.findUnique({ where: { slug } });
  if (existing) throw new AppError(409, "Category slug already exists");

  const category = await prisma.serviceCategory.create({ data: { ...input, slug } });

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

export const deleteCategory = async (id: string, adminId: string) => {
  const category = await prisma.serviceCategory.findUnique({
    where: { id },
    include: { services: { select: { id: true } } },
  });
  if (!category) throw new AppError(404, "Category not found");

  if (category.services.length > 0) {
    throw new AppError(
      400,
      `Cannot delete category "${category.name}" because it has ${category.services.length} associated service(s). Remove or reassign all services first.`
    );
  }

  await prisma.serviceCategory.delete({ where: { id } });

  await prisma.auditLog.create({
    data: {
      actorId: adminId,
      action: "category_deleted",
      targetType: "category",
      targetId: id,
      metadata: { name: category.name },
    },
  });

  return { id, deletedAt: new Date() };
};

export const createService = async (
  input: {
    categoryId: string; name: string;
    description?: string; basePrice: number; durationMins: number;
    imageUrl?: string; sortOrder?: number;
  },
  adminId: string,
) => {
  const category = await prisma.serviceCategory.findUnique({ where: { id: input.categoryId } });
  if (!category) throw new AppError(404, "Category not found");

  const slug = slugify(input.name);

  const existing = await prisma.service.findUnique({ where: { slug } });
  if (existing) throw new AppError(409, "Service slug already exists");

  const service = await prisma.service.create({ data: { ...input, slug } });

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

export const deleteService = async (id: string, adminId: string) => {
  const service = await prisma.service.findUnique({
    where: { id },
    include: { providerServices: { select: { id: true } } },
  });
  if (!service) throw new AppError(404, "Service not found");

  if (service.providerServices.length > 0) {
    throw new AppError(
      400,
      `Cannot delete service "${service.name}" because it is offered by ${service.providerServices.length} provider(s). Remove it from all providers first.`
    );
  }

  await prisma.service.delete({ where: { id } });

  await prisma.auditLog.create({
    data: {
      actorId: adminId,
      action: "service_deleted",
      targetType: "service",
      targetId: id,
      metadata: { name: service.name },
    },
  });

  return { id, deletedAt: new Date() };
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

const slugify = (text: string) => {
  return text.toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '');
}
