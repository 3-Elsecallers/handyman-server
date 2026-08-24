import { prisma } from "../db/prisma";
import { haversineDistance } from "../utils/distance";
import type { SearchProvidersInput } from "../validation/searchValidation";

export const searchProviders = async (input: SearchProvidersInput) => {
  const { lat, lng, radiusKm, categoryId, serviceId, minRating, minPrice, maxPrice, verified, q, page, limit, sortBy } = input;
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {
    status: "active",
  };

  if (verified !== undefined) {
    where.verified = verified;
  }

  if (minRating !== undefined) {
    where.avgRating = { gte: minRating };
  }

  if (serviceId) {
    where.services = {
      some: { serviceId, isActive: true },
    };
  } else if (categoryId) {
    where.services = {
      some: { service: { categoryId }, isActive: true },
    };
  }

  if (minPrice !== undefined || maxPrice !== undefined) {
    const priceFilter: Record<string, number> = {};
    if (minPrice !== undefined) priceFilter.gte = minPrice;
    if (maxPrice !== undefined) priceFilter.lte = maxPrice;

    where.services = {
      ...(where.services as Record<string, unknown> || {}),
      some: {
        ...(where.services as Record<string, { some: Record<string, unknown> }>)?.some || {},
        OR: [
          { customPrice: priceFilter },
          { service: { basePrice: priceFilter } },
        ],
      },
    };
  }

  let profiles = await prisma.providerProfile.findMany({
    where,
    include: {
      services: {
        where: { isActive: true },
        include: { service: true },
      },
    },
    skip,
    take: limit,
  });

  if (lat !== undefined && lng !== undefined) {
    profiles = profiles
      .map((p) => ({
        ...p,
        distanceKm: p.lat != null && p.lng != null
          ? haversineDistance(lat, lng, p.lat, p.lng)
          : Infinity,
      }))
      .filter((p) => p.distanceKm <= radiusKm)
      .sort((a, b) => {
        if (sortBy === "distance") return a.distanceKm - b.distanceKm;
        if (sortBy === "rating") return b.avgRating - a.avgRating;
        if (sortBy === "experience") return b.totalJobs - a.totalJobs;
        return 0;
      });
  } else if (sortBy === "rating") {
    profiles.sort((a, b) => b.avgRating - a.avgRating);
  } else if (sortBy === "experience") {
    profiles.sort((a, b) => b.totalJobs - a.totalJobs);
  }

  const total = profiles.length;

  return {
    providers: profiles,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
};

export const autocomplete = async (query: string) => {
  if (!query || query.length < 2) return [];

  const categories = await prisma.serviceCategory.findMany({
    where: {
      isActive: true,
      name: { contains: query, mode: "insensitive" },
    },
    take: 5,
    select: { id: true, name: true, slug: true, iconUrl: true },
  });

  const services = await prisma.service.findMany({
    where: {
      isActive: true,
      name: { contains: query, mode: "insensitive" },
    },
    take: 5,
    select: { id: true, name: true, slug: true },
  });

  return { categories, services };
};
