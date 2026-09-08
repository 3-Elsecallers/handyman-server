import { prisma } from "../db/prisma";
import { AppError } from "../middlewares/errorHandler.middleware";
import { publishEvent } from "../utils/kafka";
import { generateDownloadUrl, getDocumentStream } from "../config/s3";
import { config } from "../config/env";
import {
  checkRequirementCompleteness,
  getProviderChecklist,
  checkServiceCompleteness,
  getServiceChecklist,
} from "./vettingService";
import { recomputeProviderVerificationStatus } from "./providerService";

const IDENTITY_CATEGORIES = ["selfie", "ghana_card", "additional"];

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
  identityStatus?: string;
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

  if (query.identityStatus) {
    where.identityStatus = query.identityStatus;
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
  overrideReason?: string,
) => {
  const profile = await prisma.providerProfile.findUnique({ where: { id: providerId } });
  if (!profile) throw new AppError(404, "Provider not found");

  if (profile.verificationStatus !== "pending_review") {
    throw new AppError(409, "This provider's verification status has changed. Please refresh.");
  }

  if (!approved && !rejectionNote?.trim()) {
    throw new AppError(400, "Rejection reason is required when rejecting a provider");
  }

  if (approved) {
    const { complete, missing } = await checkRequirementCompleteness(providerId);
    if (!complete && !overrideReason?.trim()) {
      throw new AppError(
        400,
        `Incomplete requirements: ${missing.join(", ")}`,
      );
    }
    if (!complete && overrideReason?.trim()) {
      await prisma.auditLog.create({
        data: {
          actorId: adminId,
          action: "provider_verified_override",
          targetType: "provider",
          targetId: providerId,
          metadata: { overrideReason: overrideReason.trim(), missingRequirements: missing },
        },
      });
    }
  }

  const updatedData: {
    verified: boolean;
    status: "active" | "suspended";
    verificationStatus: "approved" | "rejected";
    rejectionNote: string | null;
    joinedAt?: Date;
    probationaryEndDate?: Date;
    probationaryBookingsRemaining?: number;
  } = {
    verified: approved,
    status: approved ? "active" : "suspended",
    verificationStatus: approved ? "approved" : "rejected",
    rejectionNote: approved ? (overrideReason?.trim() || null) : (rejectionNote?.trim() || null),
  };

  if (approved) {
    if (!profile.joinedAt) updatedData.joinedAt = new Date();

    const providerServices = await prisma.providerService.findMany({
      where: { providerId, isActive: true },
      include: { service: { include: { category: true } } },
    });
    let riskLevel: string | null = null;
    for (const ps of providerServices) {
      const level = ps.service.category.safetyRiskLevel;
      const weight = level === "high" ? 3 : level === "medium" ? 2 : 1;
      const currentWeight = riskLevel === "high" ? 3 : riskLevel === "medium" ? 2 : 1;
      if (weight >= currentWeight) riskLevel = level;
    }
    const probationBookings = riskLevel === "high" ? 10 : riskLevel === "medium" ? 8 : 5;

    updatedData.probationaryEndDate = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
    updatedData.probationaryBookingsRemaining = probationBookings;
  }

  const updated = await prisma.providerProfile.update({
    where: { id: providerId },
    data: updatedData,
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

export const reviewDocument = async (
  documentId: string,
  approved: boolean,
  adminId: string,
  rejectionReason?: string,
) => {
  const doc = await prisma.providerDocument.findUnique({ where: { id: documentId } });
  if (!doc) throw new AppError(404, "Document not found");

  if (!approved && !rejectionReason?.trim()) {
    throw new AppError(400, "Rejection reason is required when rejecting a document");
  }

  const updated = await prisma.providerDocument.update({
    where: { id: documentId },
    data: {
      status: approved ? "approved" : "rejected",
      rejectionReason: approved ? null : rejectionReason?.trim() || null,
    },
  });

  await prisma.auditLog.create({
    data: {
      actorId: adminId,
      action: approved ? "document_approved" : "document_rejected",
      targetType: "provider_document",
      targetId: documentId,
      metadata: {
        providerId: doc.providerId,
        fileName: doc.fileName,
        ...(rejectionReason?.trim() ? { rejectionReason: rejectionReason.trim() } : {}),
      },
    },
  });

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

export const getProviderIdentity = async (providerId: string) => {
  const profile = await prisma.providerProfile.findUnique({
    where: { id: providerId },
    include: {
      providerDocuments: {
        where: { category: { in: IDENTITY_CATEGORIES } },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!profile) throw new AppError(404, "Provider not found");

  return {
    identityStatus: profile.identityStatus,
    identityVerified: profile.identityVerified,
    identityRejectionNote: profile.identityRejectionNote,
    documents: profile.providerDocuments,
  };
};

export const reviewIdentity = async (
  providerId: string,
  approved: boolean,
  adminId: string,
  rejectionNote?: string,
) => {
  const profile = await prisma.providerProfile.findUnique({
    where: { id: providerId },
    include: {
      providerDocuments: { where: { category: { in: IDENTITY_CATEGORIES } } },
    },
  });
  if (!profile) throw new AppError(404, "Provider not found");

  if (profile.identityStatus !== "pending_review") {
    throw new AppError(409, "This provider's identity is not pending review.");
  }

  if (!approved && !rejectionNote?.trim()) {
    throw new AppError(400, "Rejection reason is required when rejecting identity verification");
  }

  if (approved) {
    const identityDocs = profile.providerDocuments.filter((d) =>
      IDENTITY_CATEGORIES.includes(d.category),
    );
    const requiredApproved = identityDocs.every((d) => d.status === "approved");
    if (!requiredApproved) {
      const pending = identityDocs.filter((d) => d.status !== "approved").map((d) => d.category);
      throw new AppError(400, `All identity documents must be approved. Not approved: ${pending.join(", ")}`);
    }
  }

  const updated = await prisma.providerProfile.update({
    where: { id: providerId },
    data: {
      identityStatus: approved ? "approved" : "rejected",
      identityVerified: approved,
      identityRejectionNote: approved ? null : rejectionNote?.trim() || null,
    },
  });

  await prisma.auditLog.create({
    data: {
      actorId: adminId,
      action: approved ? "identity_verified" : "identity_rejected",
      targetType: "provider",
      targetId: providerId,
      metadata: approved ? undefined : { rejectionNote: rejectionNote?.trim() },
    },
  });

  await publishEvent(approved ? "provider.identity.verified" : "provider.identity.rejected", providerId, {
    providerId,
    adminId,
    rejectionNote: approved ? undefined : rejectionNote?.trim(),
  });

  await recomputeProviderVerificationStatus(providerId);

  return updated;
};

export const getProviderServices = async (providerId: string) => {
  const profile = await prisma.providerProfile.findUnique({ where: { id: providerId } });
  if (!profile) throw new AppError(404, "Provider not found");

  const services = await prisma.providerService.findMany({
    where: { providerId },
    include: { service: { include: { category: true } } },
    orderBy: { createdAt: "desc" },
  });

  return services;
};

export const getProviderServiceChecklist = async (providerId: string, providerServiceId: string) => {
  const profile = await prisma.providerProfile.findUnique({ where: { id: providerId } });
  if (!profile) throw new AppError(404, "Provider not found");
  return getServiceChecklist(providerId, providerServiceId);
};

export const reviewService = async (
  providerId: string,
  providerServiceId: string,
  approved: boolean,
  adminId: string,
  rejectionNote?: string,
) => {
  const profile = await prisma.providerProfile.findUnique({ where: { id: providerId } });
  if (!profile) throw new AppError(404, "Provider not found");

  const ps = await prisma.providerService.findFirst({
    where: { id: providerServiceId, providerId },
  });
  if (!ps) throw new AppError(404, "Service offering not found");

  if (ps.status !== "pending_review") {
    throw new AppError(409, "This service is not pending review.");
  }

  if (profile.identityStatus !== "approved") {
    throw new AppError(
      400,
      "The provider's identity must be approved before a service can be approved.",
    );
  }

  if (!approved && !rejectionNote?.trim()) {
    throw new AppError(400, "Rejection reason is required when rejecting a service");
  }

  if (approved) {
    const { complete, missing } = await checkServiceCompleteness(providerId, providerServiceId);
    if (!complete) {
      throw new AppError(400, `Incomplete service requirements: ${missing.join(", ")}`);
    }
  }

  const updated = await prisma.providerService.update({
    where: { id: providerServiceId },
    data: {
      status: approved ? "approved" : "rejected",
      isActive: approved ? true : false,
      reviewedAt: new Date(),
      rejectionNote: approved ? null : rejectionNote?.trim() || null,
    },
  });

  await prisma.auditLog.create({
    data: {
      actorId: adminId,
      action: approved ? "service_verified" : "service_rejected",
      targetType: "provider_service",
      targetId: providerServiceId,
      metadata: {
        providerId,
        serviceId: ps.serviceId,
        ...(rejectionNote?.trim() ? { rejectionNote: rejectionNote.trim() } : {}),
      },
    },
  });

  await publishEvent(approved ? "provider.service.verified" : "provider.service.rejected", providerId, {
    providerId,
    providerServiceId,
    serviceId: ps.serviceId,
    adminId,
    rejectionNote: approved ? undefined : rejectionNote?.trim(),
  });

  await recomputeProviderVerificationStatus(providerId);

  return updated;
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

export const getProviderRequirementChecklist = async (providerId: string) => {
  const profile = await prisma.providerProfile.findUnique({ where: { id: providerId } });
  if (!profile) throw new AppError(404, "Provider not found");

  const checklist = await getProviderChecklist(providerId);
  const { complete, missing } = await checkRequirementCompleteness(providerId);

  return { ...checklist, complete, missing };
};
