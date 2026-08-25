import { prisma } from "../db/prisma";
import { AppError } from "../middlewares/errorHandler.middleware";
import { publishEvent } from "../utils/kafka";
import {
  buildS3Key,
  generateUploadUrl,
  generateDownloadUrl,
  assertObjectExists,
  extFromMime,
  validateFileType,
} from "../config/s3";
import type {
  UpdateProfileInput,
  AddServiceInput,
  RequestUploadUrlsInput,
} from "../validation/providerValidation";

export const getOrCreateProfile = async (userId: string) => {
  let profile = await prisma.providerProfile.findUnique({ where: { userId } });
  if (!profile) {
    profile = await prisma.providerProfile.create({
      data: { userId },
    });
  }
  return profile;
};

export const getMyProfile = async (userId: string) => {
  const profile = await prisma.providerProfile.findUnique({
    where: { userId },
    include: {
      services: { include: { service: true } },
    },
  });
  if (!profile) throw new AppError(404, "Provider profile not found");
  return profile;
};

export const getPublicProfile = async (providerId: string) => {
  const profile = await prisma.providerProfile.findUnique({
    where: { id: providerId },
    include: {
      services: {
        where: { isActive: true },
        include: { service: true },
      },
    },
  });
  if (!profile) throw new AppError(404, "Provider not found");
  return profile;
};

export const updateProfile = async (userId: string, input: UpdateProfileInput) => {
  const profile = await prisma.providerProfile.findUnique({ where: { userId } });
  if (!profile) throw new AppError(404, "Provider profile not found");

  const updated = await prisma.providerProfile.update({
    where: { id: profile.id },
    data: input,
  });

  await publishEvent("provider.profile.updated", profile.id, {
    providerId: profile.id,
    fields: Object.keys(input),
  });

  return updated;
};

export const addService = async (userId: string, input: AddServiceInput) => {
  const profile = await prisma.providerProfile.findUnique({ where: { userId } });
  if (!profile) throw new AppError(404, "Provider profile not found");

  const service = await prisma.service.findUnique({ where: { id: input.serviceId } });
  if (!service) throw new AppError(404, "Service not found");

  const existing = await prisma.providerService.findUnique({
    where: { providerId_serviceId: { providerId: profile.id, serviceId: input.serviceId } },
  });
  if (existing) throw new AppError(409, "Service already added");

  return prisma.providerService.create({
    data: {
      providerId: profile.id,
      serviceId: input.serviceId,
      customPrice: input.customPrice,
    },
    include: { service: true },
  });
};

export const updateMyService = async (
  userId: string,
  providerServiceId: string,
  input: { customPrice?: number; isActive?: boolean },
) => {
  const profile = await prisma.providerProfile.findUnique({ where: { userId } });
  if (!profile) throw new AppError(404, "Provider profile not found");

  const ps = await prisma.providerService.findFirst({
    where: { id: providerServiceId, providerId: profile.id },
  });
  if (!ps) throw new AppError(404, "Service offering not found");

  return prisma.providerService.update({
    where: { id: providerServiceId },
    data: input,
    include: { service: true },
  });
};

export const removeMyService = async (userId: string, providerServiceId: string) => {
  const profile = await prisma.providerProfile.findUnique({ where: { userId } });
  if (!profile) throw new AppError(404, "Provider profile not found");

  const ps = await prisma.providerService.findFirst({
    where: { id: providerServiceId, providerId: profile.id },
  });
  if (!ps) throw new AppError(404, "Service offering not found");

  await prisma.providerService.delete({ where: { id: providerServiceId } });
};

export const getDashboard = async (userId: string) => {
  const profile = await prisma.providerProfile.findUnique({ where: { userId } });
  if (!profile) throw new AppError(404, "Provider profile not found");

  const recentReviews = await prisma.review.findMany({
    where: { providerId: profile.id, status: "visible" },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: {
      id: true,
      rating: true,
      comment: true,
      customerId: true,
      createdAt: true,
    },
  });

  return {
    stats: {
      avgRating: profile.avgRating,
      totalReviews: profile.totalReviews,
      totalJobs: profile.totalJobs,
      completionRate: profile.completionRate,
      avgResponseTimeMins: profile.avgResponseTimeMins,
      verified: profile.verified,
      status: profile.status,
    },
    recentReviews,
  };
};

export const getProviderById = async (providerId: string) => {
  const profile = await prisma.providerProfile.findUnique({
    where: { id: providerId },
  });
  if (!profile) throw new AppError(404, "Provider not found");
  return profile;
};

export const getProviderServices = async (providerId: string) => {
  return prisma.providerService.findMany({
    where: { providerId, isActive: true },
    include: { service: true },
  });
};

export const requestDocumentUploadUrls = async (
  userId: string,
  input: RequestUploadUrlsInput,
) => {
  const profile = await prisma.providerProfile.findUnique({ where: { userId } });
  if (!profile) throw new AppError(404, "Provider profile not found");

  const selfieCount = input.files.filter((f) => f.category === "selfie").length;
  if (selfieCount > 1) {
    throw new AppError(400, "Only one selfie is allowed");
  }

  const ghanaCards = input.files.filter((f) => f.category === "ghana_card");
  if (ghanaCards.length > 5) {
    throw new AppError(400, "Maximum 5 Ghana Card images allowed");
  }

  const results: Array<{
    id: string;
    uploadUrl: string;
    s3Key: string;
    category: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
  }> = [];

  for (const file of input.files) {
    validateFileType(file.mimeType);
    const ext = extFromMime(file.mimeType);
    const s3Key = buildS3Key(profile.id, file.category, ext);
    const uploadUrl = await generateUploadUrl(s3Key, file.mimeType);

    const doc = await prisma.providerDocument.create({
      data: {
        providerId: profile.id,
        category: file.category,
        s3Key,
        fileName: file.fileName,
        fileSize: file.fileSize,
        mimeType: file.mimeType,
        status: "uploaded",
      },
    });

    results.push({
      id: doc.id,
      uploadUrl,
      s3Key,
      category: file.category,
      fileName: file.fileName,
      fileSize: file.fileSize,
      mimeType: file.mimeType,
    });
  }

  return results;
};

export const confirmDocumentUploads = async (
  userId: string,
  documentIds: string[],
) => {
  const profile = await prisma.providerProfile.findUnique({ where: { userId } });
  if (!profile) throw new AppError(404, "Provider profile not found");

  const docs = await prisma.providerDocument.findMany({
    where: {
      id: { in: documentIds },
      providerId: profile.id,
    },
  });

  if (docs.length !== documentIds.length) {
    throw new AppError(400, "One or more document IDs are invalid");
  }

  for (const doc of docs) {
    await assertObjectExists(doc.s3Key);
  }

  await prisma.providerDocument.updateMany({
    where: { id: { in: documentIds } },
    data: { status: "pending_review" },
  });

  await prisma.providerProfile.update({
    where: { id: profile.id },
    data: { verificationStatus: "pending_review" },
  });

  await publishEvent("provider.documents.submitted", profile.id, {
    providerId: profile.id,
    documentIds,
  });

  return { message: "Documents submitted for review" };
};

export const getMyDocuments = async (userId: string) => {
  const profile = await prisma.providerProfile.findUnique({ where: { userId } });
  if (!profile) throw new AppError(404, "Provider profile not found");

  return prisma.providerDocument.findMany({
    where: { providerId: profile.id },
    orderBy: { createdAt: "desc" },
  });
};

export const getDocumentDownloadUrl = async (
  userId: string,
  documentId: string,
) => {
  const profile = await prisma.providerProfile.findUnique({ where: { userId } });
  if (!profile) throw new AppError(404, "Provider profile not found");

  const doc = await prisma.providerDocument.findFirst({
    where: { id: documentId, providerId: profile.id },
  });
  if (!doc) throw new AppError(404, "Document not found");

  const url = await generateDownloadUrl(doc.s3Key);
  return { url, document: doc };
};
