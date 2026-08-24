import { prisma } from "../db/prisma";
import { AppError } from "../middlewares/errorHandler.middleware";
import { publishEvent } from "../utils/kafka";
import type { UpdateProfileInput, AddServiceInput } from "../validation/providerValidation";

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
